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
        masters: {
          green: "#006747",
          "green-deep": "#004d34",
          "green-light": "#008a5e",
          gold: "#c9a84c",
          "gold-light": "#d4b96a",
          "gold-dark": "#a88a3a",
          cream: "#f5f0e8",
          "cream-dark": "#ebe4d6",
          "cream-light": "#faf7f2",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        display: ["Playfair Display", "Georgia", "serif"],
        sans: ["Raleway", "system-ui", "sans-serif"],
        body: ["Raleway", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 12px rgba(0, 103, 71, 0.08)",
        "card-hover": "0 4px 20px rgba(0, 103, 71, 0.14)",
        "card-lg": "0 8px 32px rgba(0, 103, 71, 0.12)",
        gold: "0 2px 12px rgba(201, 168, 76, 0.2)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "stagger-in": "fadeSlideUp 0.4s ease-out both",
        "pulse-green": "pulseGreen 1.5s ease-in-out infinite",
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
        pulseGreen: {
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
