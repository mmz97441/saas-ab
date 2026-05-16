/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Body: DM Sans variable — premium B2B sans, characterful at small sizes
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        // Display: Fraunces variable — editorial serif for H1/H2/H3 and KPI numbers
        // Used via `font-display` utility class
        display: ['"Fraunces"', 'Georgia', 'serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
        // Mono: IBM Plex Mono — heritage financial vibe for tabular numbers
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Paper family — warm neutrals (replaces cold slate-* for surfaces)
        paper: {
          50:  '#fbfaf6',  // body bg — off-white, warm
          100: '#f5f3ec',  // raised surface
          200: '#ebe7da',  // subtle borders
          300: '#d8d3c2',  // muted borders
          400: '#a8a294',  // disabled text
          500: '#76705f',  // secondary text
          600: '#5a5547',  // body text muted
          700: '#3f3a30',  // body text
          800: '#28251f',  // strong text
          900: '#171612',  // headings
        },
        // Brand — recalibrated navy, slightly warmer than pure slate
        // Existing usages of brand-50/100/.../900 pick up the new values automatically
        brand: {
          50:  '#f3f5f8',
          100: '#dee3eb',
          200: '#bcc6d4',
          300: '#94a3b8',
          400: '#6a7c95',
          500: '#4a5b75',
          600: '#33445e',
          700: '#243349',
          800: '#1a2536',
          900: '#0f1722',
          950: '#06091010',
        },
        // Accent — amber kept, but design system rule: USE SPARINGLY
        // Only for genuinely critical highlights (validation pending, RDV imminent)
        accent: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        }
      },
      boxShadow: {
        // Custom "paper on paper" shadows — replaces Tailwind defaults for premium feel
        // Layered: 1-2px crisp + diffuse ambient (signature of editorial print design)
        'paper-sm':   '0 1px 0 0 rgba(15, 23, 34, 0.04), 0 1px 3px 0 rgba(15, 23, 34, 0.05)',
        'paper':      '0 1px 0 0 rgba(15, 23, 34, 0.04), 0 2px 6px -1px rgba(15, 23, 34, 0.06), 0 4px 12px -2px rgba(15, 23, 34, 0.04)',
        'paper-md':   '0 1px 0 0 rgba(15, 23, 34, 0.04), 0 4px 12px -2px rgba(15, 23, 34, 0.08), 0 8px 24px -4px rgba(15, 23, 34, 0.06)',
        'paper-lg':   '0 2px 0 0 rgba(15, 23, 34, 0.05), 0 8px 24px -4px rgba(15, 23, 34, 0.10), 0 16px 40px -8px rgba(15, 23, 34, 0.08)',
        'paper-xl':   '0 4px 0 0 rgba(15, 23, 34, 0.05), 0 16px 40px -8px rgba(15, 23, 34, 0.12), 0 32px 64px -16px rgba(15, 23, 34, 0.10)',
      },
      transitionTimingFunction: {
        // Premium signature easing — used on every meaningful state change
        // Aggressive ease-out (out-quint) for entrances; default cubic-bezier for the rest
        'premium':    'cubic-bezier(0.32, 0.72, 0, 1)',
        'editorial':  'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        }
      },
      animation: {
        wiggle: 'wiggle 1s ease-in-out infinite',
      }
    }
  },
  plugins: [require('tailwindcss-animate')],
}
