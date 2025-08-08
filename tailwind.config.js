/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'whatsapp-green': '#00a884',
        'whatsapp-bg': '#ece5dd',
        'whatsapp-light': '#f0f2f5',
        'whatsapp-dark': '#111b21',
        'message-in': '#fff',
        'message-out': '#d9fdd3',
      },
    },
  },
  plugins: [],
}