import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0F1E',
        surface: '#111827',
        border: '#1F2937',
        accent: '#3B82F6',
        'text-primary': '#F9FAFB',
        'text-secondary': '#9CA3AF',
        'severity-violation': '#EF4444',
        'severity-warning': '#F97316',
        'severity-pass': '#22C55E',
        navy: '#0A0F1E',
        blueprint: '#1F2937',
        cyan: '#3B82F6',
        offwhite: '#F9FAFB',
        violation: '#EF4444',
        warning: '#F97316',
        pass: '#22C55E',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(31, 41, 55, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(31, 41, 55, 0.4) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
    },
  },
  plugins: [],
}

export default config
