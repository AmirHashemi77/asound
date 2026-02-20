/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        ink: "#0b0f1a",
        navy: "#0f172a",
        mist: "#e2e8f0",
        glow: "#7c3aed",
        sea: "#14b8a6",
        sun: "#f59e0b"
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui"],
        display: ["Sora", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        soft: "0 12px 30px rgba(15, 23, 42, 0.18)",
        glow: "0 0 30px rgba(124, 58, 237, 0.35)"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: []
};
