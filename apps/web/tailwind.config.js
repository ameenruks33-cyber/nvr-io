/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b1220',
          900: '#121a2b',
          800: '#1a2438',
          700: '#243049',
        },
        accent: {
          DEFAULT: '#0f766e',
          soft: '#14b8a6',
        },
        status: {
          active: '#b91c1c',
          completed: '#15803d',
        },
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
