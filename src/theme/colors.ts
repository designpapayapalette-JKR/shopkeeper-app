// Mirrors tailwind.config.js — Stitch Design Brief §2.
// Duplicated (not shared-packaged) into agent-app deliberately: the two apps
// are independent products, not two modes of one codebase.

export const colors = {
  light: {
    background: "#FAF9F6",
    surface: "#FFFFFF",
    primary: "#0F7A5F",
    secondary: "#E8A33D",
    textPrimary: "#1A1A1A",
    textSecondary: "#6B6B6B",
    success: "#2E9E5B",
    warning: "#E8A33D",
    error: "#D64545",
    info: "#3B7DD8",
  },
  dark: {
    background: "#141414",
    surface: "#1F1F1F",
    primary: "#22B58A",
    secondary: "#F0AE4E",
    textPrimary: "#F2F2F2",
    textSecondary: "#A0A0A0",
    success: "#2E9E5B",
    warning: "#E8A33D",
    error: "#D64545",
    info: "#3B7DD8",
  },
} as const;

export type ColorScheme = keyof typeof colors;
