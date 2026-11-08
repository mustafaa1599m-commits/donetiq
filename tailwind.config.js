/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0D14',
        panel: '#121826',
        panel2: '#1A2133',
        line: '#252E45',
        brand: '#FE2C55',
        aqua: '#25F4EE',
        gold: '#FFD400',
      },
      fontFamily: {
        sans: ['var(--font-tajawal)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
