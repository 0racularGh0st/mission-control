/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          bg: 'var(--bg)',
          panel: 'var(--panel)',
          muted: 'var(--muted)',
          text: 'var(--text)',
          accent: 'var(--accent)',
          accent2: 'var(--accent-2)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
    },
  },
  plugins: [],
};
