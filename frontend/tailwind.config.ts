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
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        'intel': {
          bg: '#09090b',
          surface: '#0f0f11',
          card: '#141416',
          'card-hover': '#1a1a1e',
          border: '#27272a',
          'border-light': '#3f3f46',
          accent: '#00d4aa',
          'accent-dim': '#00b894',
          'accent-glow': 'rgba(0, 212, 170, 0.12)',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
          purple: '#a855f7',
          cyan: '#06b6d4',
          muted: '#71717a',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-up': 'slide-in-up 0.3s ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(0, 212, 170, 0.08)',
        'glow-md': '0 0 20px rgba(0, 212, 170, 0.1)',
        'card': '0 1px 2px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
export default config
