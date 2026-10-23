/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,ts,jsx,tsx}', './*.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // Emerald primary
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        surface: {
          base: '#0d1117',
          card: '#161b22',
          cardHover: '#1c2129',
          border: 'rgba(255, 255, 255, 0.08)',
          borderActive: 'rgba(16, 185, 129, 0.4)',
        },
      },
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
