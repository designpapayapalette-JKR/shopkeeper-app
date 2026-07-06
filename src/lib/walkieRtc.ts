import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  mediaDevices,
} from "react-native-webrtc";
import { apiUrl, getValidAccessToken } from "./api";

// Full-mesh WebRTC walkie-talkie: every participant in a channel opens a
// direct peer connection to every other participant, and the shopkeeper-api
// signaling server (src/ws/walkieSignaling.ts) only relays the handshake
// (SDP offers/answers, ICE candidates) — actual audio never touches the
// server. This scales fine for a shop's staff-sized channels; a dedicated
// SFU (e.g. LiveKit) would only be needed for dozens of simultaneous
// speakers per channel, which this app's use case never approaches.
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

export interface WalkiePeer {
  userId: string;
  userName: string;
}

export type WalkieConnectionState = "connecting" | "connected" | "disconnected" | "error";

interface WalkieCallbacks {
  onParticipantsChanged: (peers: WalkiePeer[]) => void;
  onConnectionStateChanged: (state: WalkieConnectionState) => void;
}

export class WalkieChannel {
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private peerNames = new Map<string, string>();
  private callbacks: WalkieCallbacks;
  private channelId: string;
  private userName: string;

  constructor(channelId: string, userName: string, callbacks: WalkieCallbacks) {
    this.channelId = channelId;
    this.userName = userName;
    this.callbacks = callbacks;
  }

  private emitParticipants() {
    const peers = Array.from(this.peerNames.entries()).map(([userId, userName]) => ({ userId, userName }));
    this.callbacks.onParticipantsChanged(peers);
  }

  async connect(): Promise<void> {
    this.callbacks.onConnectionStateChanged("connecting");

    // Mic starts muted (track.enabled = false) — push-to-talk only flips it
    // on while the button is held, matching a real walkie-talkie instead of
    // leaving the mic hot for the whole time in a channel.
    const stream = (await mediaDevices.getUserMedia({ audio: true, video: false })) as unknown as MediaStream;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    this.localStream = stream;

    const token = await getValidAccessToken();
    if (!token) throw new Error("Not signed in");
    if (!apiUrl) throw new Error("API URL not configured");
    const wsUrl = `${apiUrl.replace(/^http/, "ws")}/walkie-signal?token=${encodeURIComponent(token)}&userName=${encodeURIComponent(this.userName)}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      let settled = false;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", channelId: this.channelId }));
      };

      ws.onmessage = (event) => {
        this.handleServerMessage(event.data as string, () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        });
      };

      ws.onerror = () => {
        this.callbacks.onConnectionStateChanged("error");
        if (!settled) {
          settled = true;
          reject(new Error("Signaling connection failed"));
        }
      };

      ws.onclose = () => {
        this.callbacks.onConnectionStateChanged("disconnected");
      };
    });
  }

  private async handleServerMessage(raw: string, onJoined: () => void) {
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (message.type === "joined") {
      for (const peer of message.participants as WalkiePeer[]) {
        this.peerNames.set(peer.userId, peer.userName);
        await this.createPeerConnection(peer.userId, true);
      }
      this.emitParticipants();
      this.callbacks.onConnectionStateChanged("connected");
      onJoined();
    } else if (message.type === "peer-joined") {
      // Don't create a connection yet — the newcomer initiates the offer
      // (they see us as an existing participant on their own "joined"
      // message), and handleSignal lazily creates our side when it arrives.
      this.peerNames.set(message.userId, message.userName);
      this.emitParticipants();
    } else if (message.type === "peer-left") {
      this.peerNames.delete(message.userId);
      this.peerConnections.get(message.userId)?.close();
      this.peerConnections.delete(message.userId);
      this.emitParticipants();
    } else if (message.type === "signal") {
      await this.handleSignal(message.fromUserId, message.payload);
    } else if (message.type === "error") {
      this.callbacks.onConnectionStateChanged("error");
    }
  }

  private async createPeerConnection(targetUserId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peerConnections.set(targetUserId, pc);

    this.localStream?.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));

    // @ts-expect-error react-native-webrtc's event typings lag the DOM lib
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(targetUserId, { kind: "ice-candidate", candidate: event.candidate });
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      this.sendSignal(targetUserId, { kind: "offer", sdp: offer });
    }

    return pc;
  }

  private sendSignal(targetUserId: string, payload: unknown) {
    this.ws?.send(JSON.stringify({ type: "signal", targetUserId, payload }));
  }

  private async handleSignal(fromUserId: string, payload: any) {
    let pc = this.peerConnections.get(fromUserId);
    if (!pc) {
      pc = await this.createPeerConnection(fromUserId, false);
    }

    if (payload.kind === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal(fromUserId, { kind: "answer", sdp: answer });
    } else if (payload.kind === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    } else if (payload.kind === "ice-candidate") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // Benign — a candidate can arrive just before the remote description
        // is set in rare races; the connection still completes via later
        // candidates.
      }
    }
  }

  // Push-to-talk: called on button press-in/press-out. Overridden by
  // setMuted(true) below regardless of transmit state.
  setTransmitting(transmitting: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = transmitting;
    });
  }

  setMuted(muted: boolean) {
    if (muted) this.setTransmitting(false);
  }

  disconnect() {
    this.ws?.send(JSON.stringify({ type: "leave" }));
    this.ws?.close();
    this.ws = null;
    for (const pc of this.peerConnections.values()) pc.close();
    this.peerConnections.clear();
    this.peerNames.clear();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
  }
}
