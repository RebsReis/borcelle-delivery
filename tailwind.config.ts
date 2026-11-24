import type { Config } from "tailwindcss";

// Todas as cores, raios, sombras e fontes apontam para os tokens globais em globals.css
// Cores com suporte a opacidade (bg-surface-dark/60) sem duplicar os HEX dos tokens
const c = (v: string) => `color-mix(in srgb, var(${v}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1440px" },
    extend: {
      colors: {
        primary: { DEFAULT: c("--color-primary"), hover: c("--color-primary-hover") },
        secondary: c("--color-secondary"),
        accent: c("--color-accent"),
        bg: c("--color-background"),
        surface: { DEFAULT: c("--color-surface"), dark: c("--color-surface-dark") },
        ink: { DEFAULT: c("--color-text-primary"), muted: c("--color-text-secondary"), inverse: c("--color-text-inverse") },
        line: c("--color-border"),
        success: c("--color-success"),
        error: c("--color-error"),
      },
      fontFamily: { display: ["var(--font-display)"], body: ["var(--font-body)"] },
      borderRadius: {
        none: "var(--radius-none)", sm: "var(--radius-sm)", md: "var(--radius-md)",
        lg: "var(--radius-lg)", xl: "var(--radius-xl)", full: "var(--radius-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)", md: "var(--shadow-md)", lg: "var(--shadow-lg)",
        product: "var(--shadow-product)", cta: "var(--shadow-cta)",
      },
      spacing: {
        "s1": "var(--space-1)", "s2": "var(--space-2)", "s3": "var(--space-3)", "s4": "var(--space-4)",
        "s5": "var(--space-5)", "s6": "var(--space-6)", "s7": "var(--space-7)", "s8": "var(--space-8)", "s9": "var(--space-9)",
      },
      maxWidth: { container: "var(--container-max)" },
      transitionTimingFunction: { out: "var(--ease-out)", standard: "var(--ease-standard)", bounce: "var(--ease-bounce)" },
      transitionDuration: { fast: "150ms", normal: "300ms", medium: "600ms", slow: "1000ms" },
    },
  },
  plugins: [],
};
export default config;
