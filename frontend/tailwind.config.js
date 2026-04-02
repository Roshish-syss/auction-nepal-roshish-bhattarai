/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          blue: '#2563eb',
          gold: '#D4AF37',
        },
        background: {
          gradient: 'linear-gradient(to bottom, #e0f2fe, #ffffff)',
        }
      },
    },
  },
  plugins: [],
}

