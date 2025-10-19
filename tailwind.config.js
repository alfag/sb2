/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.njk",
    "./views/**/*.html",
    "./public/js/**/*.js",
    "./src/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe', 
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a', 
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        beer: {
          light: '#fef3c7',
          medium: '#fbbf24',
          dark: '#d97706',
          amber: '#f59e0b',
        },
        brewery: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        }
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'mono': ['SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'beer-drain': 'beer-drain 2s ease-in-out infinite',
        'foam-bubble': 'foam-bubble 1.5s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s infinite',
        'modal-slide-in': 'modalSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'beer-drain': {
          '0%': { height: '85%', opacity: '1' },
          '50%': { height: '20%', opacity: '0.7' },
          '100%': { height: '85%', opacity: '1' },
        },
        'foam-bubble': {
          '0%': { transform: 'scaleY(1)', opacity: '0.8' },
          '100%': { transform: 'scaleY(1.2)', opacity: '0.6' },
        },
        'shimmer': {
          '0%': { left: '-100%' },
          '100%': { left: '100%' },
        },
        'modalSlideIn': {
          'from': { opacity: '0', transform: 'translateY(-50px) scale(0.9)' },
          'to': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      zIndex: {
        'modal': '1050',
        'overlay': '2147483647',
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'popover': '1060',
        'tooltip': '1070',
      },
      backdropBlur: {
        'xs': '2px',
      },
      scale: {
        '102': '1.02',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}