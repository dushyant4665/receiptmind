module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#09090b", 2: "#27272a", 3: "#71717a", 4: "#a1a1aa", 5: "#d4d4d8" },
        bg: { page: "#fafafa", surface: "#ffffff", subtle: "#f4f4f5" },
        text: { primary: "#09090b", secondary: "#27272a", muted: "#71717a", ghost: "#a1a1aa" },
        border: { default: "#e4e4e7", subtle: "#f0f0f2", strong: "#d4d4d8" },
        amber: { DEFAULT: "#b45309", hover: "#92400e", surface: "#fffbeb", border: "#fde68a", glow: "rgba(180,83,9,0.15)" },
        emerald: { DEFAULT: "#059669", surface: "#ecfdf5" },
        red: { DEFAULT: "#dc2626", surface: "#fef2f2" },
        blue: { DEFAULT: "#2563eb", surface: "#eff6ff" },
        violet: { DEFAULT: "#7c3aed", surface: "#f5f3ff" },
        success: "#059669",
        error: "#dc2626",
        surface: "#fafafa",
        white: "#ffffff",
        line: "#e4e4e7",
        line2: "#f0f0f2",
      },
      borderRadius: {
        xs: "6px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.03)",
        glow: "0 0 20px rgb(180 83 9 / 0.12)",
      },
      fontFamily: {
        sans: ['"Inter"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        heading: ['"Instrument Serif"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        xs: "11px",
        sm: "13px",
        base: "14px",
        lg: "16px",
        xl: "20px",
        "2xl": "28px",
        "3xl": "36px",
        "4xl": "48px",
      },
      letterSpacing: {
        tight: "-0.025em",
        normal: "-0.01em",
        wide: "0.05em",
        wider: "0.1em",
      },
      animation: {
        "slide-up": "slideUp 0.35s ease-out both",
        "fade-in": "fadeIn 0.4s ease-out both",
      },
      keyframes: {
        slideUp: {
          from: { opacity: 0, transform: "translateY(12px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
