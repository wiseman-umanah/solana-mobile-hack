export type ThemeMode = "light" | "dark";

export type AppTheme = {
  background: string;
  foreground: string;
  surfaceCard: string;
  borderSubtle: string;
  accent: string;
  accentSoft: string;
  textMuted: string;
};

export const themes: Record<ThemeMode, AppTheme> = {
  light: {
    background: "#f6f7fb",
    foreground: "#1b1f29",
    surfaceCard: "rgba(255,255,255,0.95)",
    borderSubtle: "rgba(15, 23, 42, 0.08)",
    accent: "#4b6bfb",
    accentSoft: "rgba(75, 107, 251, 0.12)",
    textMuted: "#475569",
  },
  dark: {
    background: "#10131b",
    foreground: "#f3f5ff",
    surfaceCard: "rgba(24, 28, 39, 0.95)",
    borderSubtle: "rgba(148, 163, 184, 0.18)",
    accent: "#8098ff",
    accentSoft: "rgba(128, 152, 255, 0.2)",
    textMuted: "#94a3b8",
  },
};
