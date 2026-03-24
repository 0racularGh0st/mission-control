/** @type {import('tailwindcss').Config} */
function withOpacity(variable) {
  return ({opacityValue}) => {
    if (opacityValue === undefined) return `rgb(var(${variable}))`
    return `rgb(var(${variable}) / ${opacityValue})`
  }
}

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './stories/**/*.{js,ts,jsx,tsx,mdx}',
    './.storybook/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        accent: '#00e5ff',
        'jarvis-900': '#020617',
        'jarvis-800': '#071029',
        'jarvis-100': '#eef2ff',
        background: withOpacity('--bg'),
        surface: withOpacity('--surface'),
        text: withOpacity('--text'),
        muted: withOpacity('--muted'),
        primary: withOpacity('--primary'),
        border: withOpacity('--border')
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui']
      }
    },
  },
  plugins: [],
}
