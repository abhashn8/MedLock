import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        /** 12px captions, labels */
        "hs-caption": ["12px", { lineHeight: "1.5" }],
        /** 13px table data, secondary */
        "hs-secondary": ["13px", { lineHeight: "1.5" }],
        /** 14px body, forms */
        "hs-body": ["14px", { lineHeight: "1.5" }],
        /** 16px section headers */
        "hs-section": ["16px", { lineHeight: "1.2" }],
        /** 20px page titles */
        "hs-title": ["20px", { lineHeight: "1.2" }],
        /** 28px metric numbers */
        "hs-metric": ["28px", { lineHeight: "1.2" }],
        /** 11px nav section labels */
        "hs-nav-section": ["11px", { lineHeight: "1.2" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        hs: {
          page: "#F8F9FB",
          card: "#FFFFFF",
          fill: "#F1F3F7",
          "fill-hover": "#F8F9FB",
          border: "#E5E7EB",
          "border-strong": "#D1D5DB",
          text: "#111827",
          muted: "#6B7280",
          placeholder: "#9CA3AF",
          primary: "#1B4FD8",
          "primary-hover": "#1740B0",
          "primary-active": "#1335A0",
          success: "#16A34A",
          "success-bg": "#F0FDF4",
          warning: "#D97706",
          "warning-bg": "#FFFBEB",
          danger: "#DC2626",
          "danger-bg": "#FEF2F2",
          info: "#1B4FD8",
          "info-bg": "#EFF6FF",
          "danger-border": "#FECACA",
          "warning-border": "#FDE68A",
          "info-border": "#BFDBFE",
          "success-border": "#BBF7D0",
          "low-bg": "#F0FDF4",
          "low-text": "#16A34A",
          overlay: "rgba(17, 24, 39, 0.5)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        /** 8px inputs/buttons */
        hs: "8px",
        /** 12px cards/modals */
        "hs-card": "12px",
        /** 10px dropdowns */
        "hs-menu": "10px",
        /** 20px pills */
        "hs-pill": "20px",
      },
      boxShadow: {
        "hs-dropdown": "0 2px 8px rgba(0,0,0,0.06)",
        "hs-modal": "0 4px 24px rgba(0,0,0,0.08)",
        "hs-focus": "0 0 0 3px rgba(27,79,216,0.12)",
        "hs-focus-error": "0 0 0 3px rgba(220,38,38,0.12)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "hs-shimmer": {
          "0%": { backgroundPosition: "100% 0" },
          "100%": { backgroundPosition: "-100% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "hs-shimmer": "hs-shimmer 1.5s ease-in-out infinite",
      },
      transitionDuration: {
        hs: "150ms",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
