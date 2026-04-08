import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        shell: "rgb(var(--color-shell) / <alpha-value>)",
        plane: "rgb(var(--color-plane) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        text: {
          DEFAULT: "rgb(var(--color-text) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted) / <alpha-value>)",
          subtle: "rgb(var(--color-text-subtle) / <alpha-value>)"
        },
        accent: {
          red: "rgb(var(--color-accent-red) / <alpha-value>)",
          moss: "rgb(var(--color-accent-moss) / <alpha-value>)"
        }
      },
      boxShadow: {
        focus: "0 24px 60px -28px rgba(15, 23, 42, 0.38)"
      },
      borderRadius: {
        shell: "2rem"
      },
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "SF Pro Text", "system-ui", "sans-serif"]
      },
      spacing: {
        18: "4.5rem"
      }
    }
  },
  plugins: []
};

export default config;

