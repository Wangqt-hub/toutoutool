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
          100: "#F5E6D3"
        },
        blush: "#FFE4E1",
        accent: {
          brown: "#C4A77D",
          yellow: "#FFF9C4",
          green: "#C8E6C9"
        }
      },
      fontFamily: {
        rounded: ["\"Nunito\"", "\"Quicksand\"", "\"system-ui\"", "sans-serif"]
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.75rem"
      }
    }
  },
  plugins: []
};

export default config;

