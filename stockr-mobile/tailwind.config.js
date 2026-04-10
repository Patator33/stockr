/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e1a',
        surface: '#141824',
        'surface-active': '#1e2535',
        border: '#2a3045',
        primary: '#2b8cee',
        'text-main': '#e2e8f0',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',
        paid: '#22c55e',
        pending: '#f59e0b',
        late: '#ef4444',
      },
    },
  },
  plugins: [],
};
