import type { Config } from "tailwindcss";

/**
 * KindPath Design Kit — single source of truth for the visual language.
 * All colors are driven by CSS variables (see globals.css) so theming and
 * dark mode stay uniform. Spacing uses Tailwind's 4px base scale unchanged
 * for consistency; we only add semantic radii, shadows, and typography.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        brand: {
          50: "hsl(var(--brand-50))",
          100: "hsl(var(--brand-100))",
          200: "hsl(var(--brand-200))",
          300: "hsl(var(--brand-300))",
          400: "hsl(var(--brand-400))",
          500: "hsl(var(--brand-500))",
          600: "hsl(var(--brand-600))",
          700: "hsl(var(--brand-700))",
          800: "hsl(var(--brand-800))",
          900: "hsl(var(--brand-900))",
          950: "hsl(var(--brand-950))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      fontSize: {
        // type scale (1.250 major third), with sensible line-heights
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.01em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em" }],
        "5xl": ["3rem", { lineHeight: "1.1", letterSpacing: "-0.025em" }],
        "6xl": ["3.75rem", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(16 24 40 / 0.04)",
        sm: "0 1px 3px 0 rgb(16 24 40 / 0.08), 0 1px 2px -1px rgb(16 24 40 / 0.06)",
        md: "0 4px 12px -2px rgb(16 24 40 / 0.10), 0 2px 6px -2px rgb(16 24 40 / 0.06)",
        lg: "0 12px 28px -8px rgb(16 24 40 / 0.14), 0 4px 12px -4px rgb(16 24 40 / 0.08)",
        xl: "0 24px 48px -12px rgb(16 24 40 / 0.18)",
        brand: "0 8px 24px -6px hsl(var(--brand-600) / 0.45)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, hsl(var(--brand-600)) 0%, hsl(var(--brand-500)) 50%, hsl(var(--accent)) 100%)",
        "grid-faint":
          "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
      },
      keyframes: {
        // Two identical copies of the track sit end to end, so translating by
        // exactly -50% lands the second copy where the first began — the loop
        // has no visible seam and needs no JS to reset it.
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Hero entrance. Deliberately a CSS keyframe and not a framer-motion
        // animation: CSS animations complete in a background tab, while
        // rAF-driven ones stall there. A visitor who cmd-clicks the link and
        // comes back to the tab a minute later should not find an empty hero,
        // and above-the-fold copy shouldn't need JS to have run to be readable.
        // Line-drawing for sparklines. Paired with pathLength="1" on the path,
        // which normalises its length to 1 so a single dasharray works for any
        // geometry. CSS rather than framer-motion for the same reason the hero
        // is: this renders inside the dashboard, and app data must not need
        // requestAnimationFrame to have run in order to be visible.
        draw: {
          "0%": { strokeDashoffset: "1" },
          "100%": { strokeDashoffset: "0" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(26px)", filter: "blur(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "0.6" },
          "70%, 100%": { transform: "scale(1.4)", opacity: "0" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        marquee: "marquee 38s linear infinite",
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "rise-in": "rise-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        draw: "draw 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "float 5s ease-in-out infinite",
        "float-slow": "float 7s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
