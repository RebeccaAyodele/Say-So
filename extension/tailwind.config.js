/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,ts,jsx,tsx}', './*.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f3ee',
          100: '#e0e7dd',
          200: '#bdcbb9',
          300: '#526e57',
          400: '#48634e',
          500: '#3f5945',
          600: '#354d3b',
          700: '#2d4333',
          800: '#25392b',
          900: '#1d2f23',
        },
        surface: {
          base: '#f5f4ef',
          card: '#fffefa',
          cardHover: '#f0efe8',
          border: '#deddd5',
          borderActive: '#879681',
          bg: '#eeede6',
        },
        gray: {
          100: '#292a25',
          200: '#3c3d37',
          300: '#50514a',
          400: '#66675f',
          500: '#7c7d75',
          600: '#999a91',
        },
      },
      fontFamily: { sans: ['Segoe UI', 'Arial', 'sans-serif'] },
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
