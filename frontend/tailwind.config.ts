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
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0px',
      },
      colors: {
        'intel': {
          bg: '#0a0a0a',
          surface: '#0a0a0a',
          card: '#111111',
          'card-hover': '#161616',
          border: '#27272a',
          'border-light': '#3f3f46',
          'border-active': '#52525b',
          accent: '#e4e4e7',
          'accent-dim': '#a1a1aa',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
          success: '#22c55e',
          muted: '#71717a',
          dim: '#52525b',
        }
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-in-up': 'slide-in-up 0.2s ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
export default config
