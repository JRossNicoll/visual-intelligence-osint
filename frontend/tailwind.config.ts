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
      colors: {
        'g': {
          bg: '#050507',
          surface: '#0c0c10',
          card: '#111118',
          'card-hover': '#16161f',
          border: 'rgba(255,255,255,0.06)',
          'border-light': 'rgba(255,255,255,0.10)',
          'border-active': 'rgba(255,255,255,0.16)',
          accent: '#4a9eff',
          'accent-dim': '#2a5f9e',
          text: '#e2e2ea',
          'text-secondary': '#8b8b9e',
          'text-muted': '#55556a',
          'text-dim': '#3a3a4a',
          success: '#34d399',
          danger: '#f87171',
          warning: '#fbbf24',
          info: '#60a5fa',
        }
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
