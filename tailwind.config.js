/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.{tsx,ts,html}", "!./node_modules/**"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "Inter", "sans-serif"]
      }
    }
  },
  plugins: []
}
