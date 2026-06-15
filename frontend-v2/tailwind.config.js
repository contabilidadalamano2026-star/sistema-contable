/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#1a1d24',
        surface: '#232731',
        primary: '#4caf50',
        secondary: '#2196f3',
        danger: '#f44336',
        warning: '#ff9800',
      }
    },
  },
  plugins: [],
}
