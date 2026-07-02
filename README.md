# shopkeeper-app

Owner/manager/staff-facing app — mobile + tablet, full feature set (Expo + React Native + Expo Router + NativeWind). See the [master build doc](../Shopkeeper-ERP-App-Master-Build-Document.md) and [Stitch Design Brief](../Stitch-Design-Brief.md) (§5, Part A).

This repo was hand-scaffolded (package.json, config, and a placeholder screen per module) rather than generated via `create-expo-app`, since Node wasn't available at scaffold time. Before first run:

```bash
npm install
npx expo install --fix   # reconciles dependency versions against your installed Expo SDK
cp .env.example .env     # point EXPO_PUBLIC_API_URL at your shopkeeper-backend instance
npx expo start --dev-client
```

**Why a dev client, not Expo Go:** thermal printer (Bluetooth/BLE), background GPS, and WebRTC (LiveKit) all need custom native modules — Expo Go can't load them past the prototype stage (§13 of the build doc). You'll need an EAS dev client build (`eas build --profile development`) once those features land.

## Structure

- `app/` — Expo Router routes: `(auth)/login`, `(tabs)/{index,pos,inventory,ledger,more}` — placeholders only, wired up per the phased roadmap
- `src/theme/colors.ts` — Stitch color tokens (also mirrored in `tailwind.config.js`)
- `src/lib/directus.ts` — Directus SDK client stub, reads `EXPO_PUBLIC_API_URL`
- `src/components/` — shared UI components

## Not installed yet

Native modules for specific features (`expo-camera`, `expo-location`, `expo-sharing`, LiveKit RN SDK, a thermal-printer BLE library) are added when each feature is actually built (Phase 1–3), not during scaffolding.
