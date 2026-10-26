/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,ts,jsx,tsx}', './*.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1f4f1',
          100: '#dce5dc',
          200: '#c1d0c2',
          300: '#a5b9a6',
          400: '#91a692',
          500: '#7b937d',
          600: '#667d68',
          700: '#526b56',
          800: '#405544',
          900: '#2e3e31',
        },
        surface: {
          base: '#111412',
          card: '#191e1a',
          cardHover: '#222923',
          border: '#303832',
          borderActive: '#52715b',
        },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-from-bottom': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'in': 'fade-in 0.3s ease-out, slide-in-from-bottom 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
