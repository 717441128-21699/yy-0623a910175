/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        ink: {
          50: "#f7f5f1",
          100: "#faf7f2",
          200: "#f0e8db",
          300: "#e5d7c3",
          400: "#d4a574",
          500: "#c48a5a",
          600: "#a86c3f",
          700: "#7a4e2d",
          800: "#4d321d",
          900: "#2a1b10",
        },
        midnight: {
          50: "#eef3f8",
          100: "#d4dfe8",
          200: "#a9bed0",
          300: "#799cb5",
          400: "#4c7a98",
          500: "#2d5a78",
          600: "#1e3a5f",
          700: "#172e4c",
          800: "#11233a",
          900: "#0b1928",
        },
        role: {
          male: "#3b82f6",
          female: "#ec4899",
          villain: "#dc2626",
          narrator: "#6b7280",
          title: "#a855f7",
          dialogue: "#10b981",
          narration: "#64748b",
        },
      },
      fontFamily: {
        song: ['"Noto Serif SC"', '"Source Han Serif SC"', '"SimSun"', "serif"],
        hei: ['"Noto Sans SC"', '"Source Han Sans SC"', '"Microsoft YaHei"', "sans-serif"],
      },
      boxShadow: {
        paper: "0 1px 3px rgba(30, 58, 95, 0.08), 0 4px 12px rgba(30, 58, 95, 0.06)",
        card: "0 2px 8px rgba(30, 58, 95, 0.1), 0 8px 24px rgba(30, 58, 95, 0.08)",
        glow: "0 0 0 3px rgba(212, 165, 116, 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
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
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      backgroundImage: {
        paper: "radial-gradient(circle at 20% 20%, rgba(212, 165, 116, 0.06) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(30, 58, 95, 0.04) 0%, transparent 50%)",
      },
    },
  },
  plugins: [],
};
