import { useFonts } from "expo-font";

// Gilroy free tier — 2 weights only (Light 300, ExtraBold 800; see
// assets/fonts/ + the EULA shipped alongside the web projects'
// public/fonts/Gilroy-EULA.pdf for license terms). Registered under two
// distinct family names since React Native has no CSS-style font-weight
// matching within a single family — tailwind.config.js's fontFamily
// entries pick whichever of these two suits each token's weight.
export function useAppFonts(): [boolean, Error | null] {
  const [loaded, error] = useFonts({
    "Gilroy-Light": require("../../assets/fonts/Gilroy-Light.otf"),
    "Gilroy-ExtraBold": require("../../assets/fonts/Gilroy-ExtraBold.otf"),
  });
  return [loaded, error ?? null];
}
