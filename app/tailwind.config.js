/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neutral: {
          0: "rgb(var(--neutral-0) / <alpha-value>)",
          50: "rgb(var(--neutral-50) / <alpha-value>)",
          100: "rgb(var(--neutral-100) / <alpha-value>)",
          200: "rgb(var(--neutral-200) / <alpha-value>)",
          300: "rgb(var(--neutral-300) / <alpha-value>)",
          400: "rgb(var(--neutral-400) / <alpha-value>)",
          500: "rgb(var(--neutral-500) / <alpha-value>)",
          600: "rgb(var(--neutral-600) / <alpha-value>)",
          700: "rgb(var(--neutral-700) / <alpha-value>)",
          800: "rgb(var(--neutral-800) / <alpha-value>)",
          900: "rgb(var(--neutral-900) / <alpha-value>)",
          950: "rgb(var(--neutral-950) / <alpha-value>)",
        },
        primary: {
          400: "rgb(var(--primary-400) / <alpha-value>)",
          500: "rgb(var(--primary-500) / <alpha-value>)",
          700: "rgb(var(--primary-700) / <alpha-value>)",
          900: "rgb(var(--primary-900) / <alpha-value>)",
        },
        "strong-950": "rgb(var(--neutral-950) / <alpha-value>)",
        "surface-900": "rgb(var(--neutral-900) / <alpha-value>)",
        "surface-800": "rgb(var(--neutral-800) / <alpha-value>)",
        soft: {
          300: "rgb(var(--neutral-300) / <alpha-value>)",
          400: "rgb(var(--neutral-400) / <alpha-value>)",
        },
        sub: { 500: "rgb(var(--neutral-500) / <alpha-value>)" },
        "success-500": "rgb(var(--success-500) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        h2: ["64px", { lineHeight: "72px", letterSpacing: "-0.04em", fontWeight: "600" }],
        h3: ["48px", { lineHeight: "56px", letterSpacing: "-0.03em", fontWeight: "600" }],
        h6: ["24px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
        "body-md": ["16px", { lineHeight: "28px", letterSpacing: "-0.02em" }],
        "body-sm": ["14px", { lineHeight: "24px", letterSpacing: "-0.02em" }],
        "body-xs": ["12px", { lineHeight: "16px", letterSpacing: "-0.02em" }],
      },
      spacing: {
        "2xs": "2px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "40px",
        "4xl": "48px",
        "5xl": "56px",
        "6xl": "64px",
        "7xl": "80px",
        "8xl": "120px",
        "9xl": "140px",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
      },
      boxShadow: {
        "button-primary":
          "inset 0 2px 6px rgb(255 255 255 / 0.25), inset 0 -2px 4px rgb(14 18 27 / 0.3), 0 16px 24px -8px rgb(24 27 37 / 0.1), 0 0 0 1px rgb(var(--primary-700))",
        "button-neutral":
          "inset 0 2px 6px rgb(255 255 255 / 0.2), inset 0 -2px 4px rgb(var(--neutral-950)), 0 16px 24px -8px rgb(24 27 37 / 0.1), 0 0 0 1px rgb(var(--neutral-800))",
        "button-secondary":
          "inset 0 2px 6px rgb(var(--neutral-0)), inset 0 -2px 4px rgb(14 18 27 / 0.2), 0 16px 24px -8px rgb(24 27 37 / 0.1), 0 0 0 1px rgb(var(--neutral-200))",
        plate: "inset 0 -6px 6px rgb(var(--neutral-900)), inset 0 2px 16px rgb(var(--neutral-700))",
      },
      backgroundImage: {
        "heading-gradient": "linear-gradient(to bottom, rgb(var(--neutral-0)), rgb(var(--neutral-400)))",
        plate: "linear-gradient(to bottom, rgb(var(--neutral-800)), rgb(var(--neutral-900)))",
      },
    },
  },
  plugins: [],
};
