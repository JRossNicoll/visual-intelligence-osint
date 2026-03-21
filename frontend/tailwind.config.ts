import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
      colors: {
        'intel': {
          bg: '#080a10',
          surface: '#0d1117',
          panel: '#131820',
          card: '#171e28',
          border: '#1e2738',
          'border-light': '#283446',
          accent: '#00cc6a',
          'accent-dim': '#00994f',
          muted: '#6b7a8d',
          danger: '#ef4444',
          warning: '#f97316',
          caution: '#eab308',
          info: '#64748b',
        },
        sev: {
          critical: '#ef4444',
          high: '#f97316',
          medium: '#eab308',
          low: '#64748b',
        }
      },
      borderRadius: {
        'sm': '2px',
        'DEFAULT': '3px',
        'md': '4px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
export default config
