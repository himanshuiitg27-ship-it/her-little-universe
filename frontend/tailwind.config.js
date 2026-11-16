const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
const scale = (name, steps) => Object.fromEntries(steps.map((s) => [s, v(`${name}-${s}`)]))

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        soft: v('surface2'),
        line: v('line'),
        ink: { DEFAULT: v('ink'), 2: v('ink2'), 3: v('ink3') },
        blush: scale('blush', [50, 100, 200, 300, 400, 500, 600]),
        lavender: scale('lavender', [50, 100, 200, 300, 400, 500, 600]),
        sage: scale('sage', [50, 100, 200, 300, 400, 500, 600]),
        cream: scale('cream', [50, 100, 200]),
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        script: ['Caveat', 'cursive'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        soft: '0 2px 4px rgb(var(--shadow) / 0.04), 0 8px 24px rgb(var(--shadow) / 0.07)',
        lift: '0 4px 8px rgb(var(--shadow) / 0.06), 0 16px 40px rgb(var(--shadow) / 0.12)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { float: 'float 4s ease-in-out infinite' },
    },
  },
  plugins: [],
}
