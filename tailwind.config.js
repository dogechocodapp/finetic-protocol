/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        finetic: {
          bg: '#020617',
          card: '#0F172A',
          border: '#1E293B',
          hover: '#334155',
          purple: '#8B5CF6',
          cyan: '#06B6D4',
          green: '#10B981',
          red: '#DC2626',
          gold: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'finetic-gradient': 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
        'finetic-header': 'linear-gradient(135deg, #0F172A 0%, #1a1147 50%, #0F172A 100%)',
      },
    },
  },
  plugins: [],
};
