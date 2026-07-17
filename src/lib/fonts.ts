import { useFonts } from "expo-font";
import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from "@expo-google-fonts/poppins";

// Brand typeface — replaces Gilroy (its free tier only had 2 weights,
// which wasn't enough for the app's font-medium/semibold/bold/extrabold
// usage). Poppins is a first-class Google Font (OFL-1.1, unrestricted
// commercial/redistribution use) via @expo-google-fonts/poppins — no
// manual file/EULA management needed, unlike the earlier Gilroy setup.
export function useAppFonts(): [boolean, Error | null] {
  const [loaded, error] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });
  return [loaded, error ?? null];
}
