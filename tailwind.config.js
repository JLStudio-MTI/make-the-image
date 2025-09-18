/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
    inter: ['Inter', 'sans-serif'],
      },

      gridTemplateColumns: {
        100: 'repeat(100, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
}
