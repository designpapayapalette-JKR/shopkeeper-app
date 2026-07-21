import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import type { ThemeProp } from 'react-native-paper/lib/typescript/types';

const fontConfig = {
 displayLarge: { fontFamily: 'Poppins_400Regular', fontWeight: '400' as const },
 displayMedium: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
 displaySmall: { fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
 headlineLarge: { fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
 headlineMedium: { fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
 headlineSmall: { fontFamily: 'Poppins_600SemiBold', fontWeight: '600' as const },
 titleLarge: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
 titleMedium: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
 titleSmall: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
 bodyLarge: { fontFamily: 'Poppins_400Regular', fontWeight: '400' as const },
 bodyMedium: { fontFamily: 'Poppins_400Regular', fontWeight: '400' as const },
 bodySmall: { fontFamily: 'Poppins_400Regular', fontWeight: '400' as const },
 labelLarge: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
 labelMedium: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
 labelSmall: { fontFamily: 'Poppins_500Medium', fontWeight: '500' as const },
};

const fonts = configureFonts({ config: fontConfig });

export const MMCTheme: ThemeProp = {
 ...MD3LightTheme,
 fonts,
 colors: {
 ...MD3LightTheme.colors,
 primary: '#0368FE',
 primaryContainer: '#D8E2FF',
 onPrimaryContainer: '#001B3E',
 secondary: '#835400',
 secondaryContainer: '#FFDDB3',
 onSecondaryContainer: '#2A1800',
 tertiary: '#873D34',
 tertiaryContainer: '#FFDAD5',
 surface: '#FCF9F8',
 surfaceVariant: '#F0EDED',
 background: '#FCF9F8',
 error: '#D64545',
 errorContainer: '#FFDAD6',
 onBackground: '#1C1B1B',
 onSurface: '#1C1B1B',
 onSurfaceVariant: '#49454E',
 outline: '#7A767E',
 outlineVariant: '#C7C2CA',
 elevation: {
 level0: 'transparent',
 level1: '#FCF9F8',
 level2: '#F9F5F3',
 level3: '#F5F1EF',
 level4: '#F4F0ED',
 level5: '#F2EDEA',
 },
 },
 roundness: 12,
};

export const MMCDarkTheme: ThemeProp = {
 ...MD3DarkTheme,
 fonts,
 colors: {
 ...MD3DarkTheme.colors,
 primary: '#B0CAFF',
 primaryContainer: '#004DFF',
 onPrimaryContainer: '#D8E2FF',
 secondary: '#FFB951',
 secondaryContainer: '#5E2E00',
 tertiary: '#FFB4A7',
 error: '#FFB4AB',
 surface: '#1F1F1F',
 surfaceVariant: '#2C2C2C',
 background: '#141414',
 onBackground: '#E5E2E1',
 onSurface: '#E5E2E1',
 onSurfaceVariant: '#C7C2CA',
 outline: '#938F99',
 outlineVariant: '#49454E',
 elevation: {
 level0: 'transparent',
 level1: '#1F1F1F',
 level2: '#242424',
 level3: '#292929',
 level4: '#2B2B2B',
 level5: '#2E2E2E',
 },
 },
 roundness: 12,
};
