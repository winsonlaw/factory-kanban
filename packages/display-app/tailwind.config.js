/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        cyan: { DEFAULT: '#00d4ff' },
        green: { neon: '#00ff9d' },
        orange: { warn: '#ffb340' },
        red: { alarm: '#ff4a4a' }
      },
      fontFamily: {
        rajdhani: ['Rajdhani', 'monospace'],
        inter: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
      }
    }
  },
  plugins: []
}
