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
          bg: '#121416',
          surface: '#1b1d21',
          panel: '#222428',
          card: '#292b30',
          border: '#32353b',
          'border-light': '#3e4148',
          accent: '#d4956a',
          'accent-dim': '#b37a55',
          muted: '#7d8189',
          danger: '#c75050',
          warning: '#d97736',
          caution: '#c9a74e',
          info: '#6b7280',
        },
        sev: {
          critical: '#c75050',
          high: '#d97736',
          medium: '#c9a74e',
          low: '#6b7280',
        },
        evt: {
          alert: '#c75050',
          movement: '#4a9e7a',
          transaction: '#5b8ec9',
          detection: '#5aa0a0',
          appearance: '#8b6db5',
          system: '#7d8189',
        },
      },
      borderRadius: {
        'sm': '3px',
        'DEFAULT': '4px',
        'md': '6px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
export default config
