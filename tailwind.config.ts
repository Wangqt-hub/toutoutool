import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FFF8F0",
          100: "#F5E6D3",
          200: "#EAD7C4"
        },
        blush: {
          DEFAULT: "#FFE4E1",
          100: "#FFF0EF",
        },
        accent: {
          brown: "#C4A77D",
          deep: "#8A6B4E",
          yellow: "#FFF9C4",
          green: "#C8E6C9",
          blue: "#D0E8F2",
          pink: "#F4C2C2",
          mint: "#E0F4E8"
        }
      },
      fontFamily: {
        rounded: ["\"Nunito\"", "\"Quicksand\"", "\"system-ui\"", "sans-serif"]
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem",
        "4xl": "2.25rem",
        "blob": "40% 60% 70% 30% / 40% 50% 60% 50%"
      },
      boxShadow: {
        "cute": "0 10px 40px -10px rgba(196, 167, 125, 0.15)",
        "cute-hover": "0 20px 50px -10px rgba(196, 167, 125, 0.25)",
        "glass": "0 8px 32px 0 rgba(196, 167, 125, 0.1)",
        "surface": "0 4px 14px 0 rgba(0, 0, 0, 0.05)"
      },
      animation: {
        'blob': 'blob 7s infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    }
  },
  plugins: []
};

export default config;

