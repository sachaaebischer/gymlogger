import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:          "#080808",
        card:        "#111111",
        surface:     "#1A1A1A",
        cardborder:  "#1F1F1F",
        fg:          "#EFEFEF",
        muted:       "#606060",
        "muted-fg":  "#404040",
        accent:      "#C8FF00",
        "accent-dim":"#8FB500",
        good:        "#00C980",
        bad:         "#FF3B30",
        warn:        "#FF9F0A",
      },
      boxShadow: {
        "glow-accent": "0 0 24px 0 rgba(200,255,0,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
