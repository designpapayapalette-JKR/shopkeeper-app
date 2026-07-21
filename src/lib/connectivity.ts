import NetInfo from "@react-native-community/netinfo";

export type ConnectivityListener = (isConnected: boolean) => void;

const listeners = new Set<ConnectivityListener>();
let currentState = true;

export function getIsConnected(): boolean {
 return currentState;
}

export function subscribeToConnectivity(listener: ConnectivityListener): () => void {
 listeners.add(listener);
 listener(currentState);
 return () => { listeners.delete(listener); };
}

// Called once at app startup
export function startConnectivityMonitoring(): () => void {
 const unsub = NetInfo.addEventListener((state) => {
 const connected = state.isConnected ?? true;
 if (connected !== currentState) {
 currentState = connected;
 listeners.forEach((fn) => fn(connected));
 }
 });
 NetInfo.fetch().then((state) => {
 currentState = state.isConnected ?? true;
 listeners.forEach((fn) => fn(currentState));
 });
 return unsub;
}
