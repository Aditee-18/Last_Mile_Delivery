/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f6ff',
          100: '#e0edff',
          500: '#2563eb',
          600: '#1d4ed8',
          800: '#1e3a8a',
          900: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};
