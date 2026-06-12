import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0C0A09',
        surface: '#1C1917',
        border: '#44403C',
        accent: '#EE690B',
        'text-primary': '#FAFAF9',
        'text-secondary': '#A8A29E',
        'severity-violation': '#EF4444',
        'severity-warning': '#F97316',
        'severity-pass': '#22C55E',
        navy: '#0C0A09',
        blueprint: '#44403C',
        cyan: '#EE690B',
        offwhite: '#FAFAF9',
        rust: '#C2410C',
        violation: '#EF4444',
        warning: '#F97316',
        pass: '#22C55E',
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(68, 64, 60, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(68, 64, 60, 0.25) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '48px 48px',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - var(--gap)))' },
        },
        'marquee-vertical': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(calc(-100% - var(--gap)))' },
        },
      },
      animation: {
        marquee: 'marquee var(--duration) infinite linear',
        'marquee-vertical': 'marquee-vertical var(--duration) linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
