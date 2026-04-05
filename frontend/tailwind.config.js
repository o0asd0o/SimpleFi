/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": "#120F1C",
        "sheet-bg": "#1C1830",
      },
    },
  },
  plugins: [],
};
