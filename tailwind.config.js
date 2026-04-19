/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta mediterránea cálida
        terracota: {
          50: "#fdf4ef",
          100: "#fae6d6",
          200: "#f4c9a9",
          300: "#eaa576",
          400: "#e08050",
          500: "#c95f33",
          600: "#b24a28",
          700: "#933924",
          800: "#773024",
          900: "#622a21",
        },
        oliva: {
          50: "#f6f7ef",
          100: "#e9eed9",
          200: "#d3ddb5",
          300: "#b5c686",
          400: "#97ad5f",
          500: "#789147",
          600: "#5c7136",
          700: "#47582d",
          800: "#3a4728",
          900: "#313c25",
        },
        crema: {
          50: "#fdfaf3",
          100: "#f8efdb",
          200: "#f2e0b9",
          300: "#e9c988",
        },
        azulmar: {
          500: "#3a7a8c",
          600: "#2f6373",
          700: "#284f5c",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
