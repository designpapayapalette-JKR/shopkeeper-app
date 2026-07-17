import { useState } from "react";

// Gilroy is the brand typeface but is a commercial font with no
// redistribution license on file for this repo — the actual .ttf/.otf
// files are not checked in. Once they're supplied, drop them into
// assets/fonts/ (e.g. Gilroy-Regular.ttf, Gilroy-Medium.ttf,
// Gilroy-SemiBold.ttf, Gilroy-Bold.ttf, Gilroy-Black.ttf) and replace the
// body of useAppFonts() with:
//
//   import { useFonts } from "expo-font";
//   export function useAppFonts() {
//     return useFonts({
//       "Gilroy-Regular": require("../../assets/fonts/Gilroy-Regular.ttf"),
//       "Gilroy-Medium": require("../../assets/fonts/Gilroy-Medium.ttf"),
//       "Gilroy-SemiBold": require("../../assets/fonts/Gilroy-SemiBold.ttf"),
//       "Gilroy-Bold": require("../../assets/fonts/Gilroy-Bold.ttf"),
//       "Gilroy-Black": require("../../assets/fonts/Gilroy-Black.ttf"),
//     });
//   }
//
// `require()` on a path that doesn't exist fails at bundle time, which is
// why this isn't wired up yet — a no-op stub here is the safe placeholder
// so tailwind.config.js's `font-*` classes ("Gilroy") don't crash the app;
// RN just falls back to the platform default font until real files exist.
export function useAppFonts(): [boolean, Error | null] {
  const [loaded] = useState(true);
  return [loaded, null];
}
