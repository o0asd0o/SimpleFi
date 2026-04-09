/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      spacing: {
        "safe-t": "env(safe-area-inset-top, 0px)",
        "safe-b": "env(safe-area-inset-bottom, 0px)",
        "safe-l": "env(safe-area-inset-left, 0px)",
        "safe-r": "env(safe-area-inset-right, 0px)",
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Semantic tokens — values swap between light/dark via CSS variables
        "app-bg": "var(--bg)",
        "sheet-bg": "var(--sheet)",
        // Surface backgrounds (cards, inputs, pills)
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hv)",
        "surface-active": "var(--surface-ac)",
        // Text hierarchy
        fg: "var(--fg)",
        "fg-2": "var(--fg-2)",
        "fg-3": "var(--fg-3)",
        "fg-4": "var(--fg-4)",
        // Borders
        dim: "var(--border)",
        "dim-strong": "var(--border-strong)",
        // Transaction amount colors
        "amount-income": "var(--amount-income)",
        "amount-expense": "var(--amount-expense)",
        // Misc
        overlay: "var(--overlay)",
        "overlay-heavy": "var(--overlay-heavy)",
        handle: "var(--handle)",
      },
    },
  },
  plugins: [],
};
