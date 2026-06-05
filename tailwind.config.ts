import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0A0F1E',
        blueprint: '#1E3A5F',
        cyan: '#00D4FF',
        offwhite: '#F8FAFF',
        violation: '#FF3B3B',
        warning: '#FF9500',
        pass: '#34C759',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(30, 58, 95, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 58, 95, 0.3) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
    },
  },
  plugins: [],
}

export default config
