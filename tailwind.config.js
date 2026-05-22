/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background:   '#F5F4F0',
        surface:      '#FFFFFF',
        'surface-2':  '#EDECEA',
        gold:         '#C9A84C',
        'gold-hover': '#B5902E',
        danger:       '#E63946',
        muted:        '#7C7267',
        border:       '#E0DDD7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
