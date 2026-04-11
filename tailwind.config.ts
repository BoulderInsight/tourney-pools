import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tp: {
          primary: "#1a365d",
          "primary-deep": "#0f2440",
          "primary-light": "#2a5298",
          accent: "#d4a843",
          "accent-light": "#e0be6a",
          "accent-dark": "#b08a2e",
          bg: "#f7f5f2",
          "bg-dark": "#eae6df",
          "bg-light": "#faf9f7",
        },
      },
      fontFamily: {
        serif: ["DM Serif Display", "Georgia", "serif"],
        display: ["DM Serif Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 12px rgba(26, 54, 93, 0.08)",
        "card-hover": "0 4px 20px rgba(26, 54, 93, 0.14)",
        "card-lg": "0 8px 32px rgba(26, 54, 93, 0.12)",
        gold: "0 2px 12px rgba(212, 168, 67, 0.2)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "stagger-in": "fadeSlideUp 0.4s ease-out both",
        "pulse-primary": "pulsePrimary 1.5s ease-in-out infinite",
        "expand": "expand 0.15s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeSlideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulsePrimary: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        expand: {
          "0%": { opacity: "0", maxHeight: "0" },
          "100%": { opacity: "1", maxHeight: "500px" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
