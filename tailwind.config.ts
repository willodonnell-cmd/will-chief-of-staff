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
        /* === Design system tokens === */
        bg:      "rgb(var(--color-bg) / <alpha-value>)",
        surface: {
          DEFAULT:   "rgb(var(--color-surface) / <alpha-value>)",
          secondary: "rgb(var(--color-surface-secondary) / <alpha-value>)"
        },
        text: {
          DEFAULT:   "rgb(var(--color-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
          muted:     "rgb(var(--color-text-muted) / <alpha-value>)",
          /* legacy aliases */
          subtle:    "rgb(var(--color-text-subtle) / <alpha-value>)"
        },
        sidebar: {
          bg:        "rgb(var(--color-sidebar-bg) / <alpha-value>)",
          text:      "rgb(var(--color-sidebar-text) / <alpha-value>)",
          muted:     "rgb(var(--color-sidebar-muted) / <alpha-value>)",
          active:    "rgb(var(--color-sidebar-active) / <alpha-value>)"
        },
        /* Functional / status */
        live:       "rgb(var(--color-live) / <alpha-value>)",
        actionable: "rgb(var(--color-actionable) / <alpha-value>)",
        watch:      "rgb(var(--color-watch) / <alpha-value>)",
        hypothesis: "rgb(var(--color-hypothesis) / <alpha-value>)",
        pressure:   "rgb(var(--color-pressure) / <alpha-value>)",
        signal:     "rgb(var(--color-signal) / <alpha-value>)",
        priority:   "rgb(var(--color-high-priority) / <alpha-value>)",
        /* Accent shortcuts */
        accent: {
          red:  "rgb(var(--color-accent-red) / <alpha-value>)",
          moss: "rgb(var(--color-accent-moss) / <alpha-value>)"
        },
        /* Legacy shell tokens — keeps existing components working */
        shell:  "rgb(var(--color-shell) / <alpha-value>)",
        plane:  "rgb(var(--color-plane) / <alpha-value>)",
        line:   "rgb(var(--color-line) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "DM Sans", "Helvetica Neue", "sans-serif"]
      },
      fontSize: {
        /* Design system type scale */
        "ds-xs":   ["11px", { lineHeight: "1.4",  letterSpacing: "0.06em" }],
        "ds-sm":   ["13px", { lineHeight: "1.5" }],
        "ds-base": ["15px", { lineHeight: "1.55" }],
        "ds-lg":   ["18px", { lineHeight: "1.35" }],
        "ds-xl":   ["24px", { lineHeight: "1.3" }],
        "ds-2xl":  ["32px", { lineHeight: "1.15" }],
        "ds-3xl":  ["42px", { lineHeight: "1.1" }]
      },
      borderRadius: {
        card:   "12px",
        "card-sm": "10px",
        btn:    "8px",
        pill:   "4px",
        shell:  "2rem"
      },
      boxShadow: {
        focus: "0 24px 60px -28px rgba(15, 23, 42, 0.38)"
      },
      spacing: {
        18: "4.5rem"
      }
    }
  },
  plugins: []
};

export default config;
