/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "media", // system-following; manual override handled via NativeWind's colorScheme API later
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Stitch Design Brief §2 — light values as DEFAULT, dark values as `-dark` variants,
      // used as `bg-background dark:bg-background-dark` etc.
      colors: {
        background: { DEFAULT: "#FAF9F6", dark: "#141414" },
        surface: { DEFAULT: "#FFFFFF", dark: "#1F1F1F" },
        primary: { DEFAULT: "#0F7A5F", dark: "#22B58A" },
        secondary: { DEFAULT: "#E8A33D", dark: "#F0AE4E" },
        "text-primary": { DEFAULT: "#1A1A1A", dark: "#F2F2F2" },
        "text-secondary": { DEFAULT: "#6B6B6B", dark: "#A0A0A0" },
        success: { DEFAULT: "#2E9E5B" },
        warning: { DEFAULT: "#E8A33D" },
        error: { DEFAULT: "#D64545" },
        info: { DEFAULT: "#3B7DD8" },
      },
    },
  },
  plugins: [],
};
