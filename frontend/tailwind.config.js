/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm color palette for matrimonial website
        primary: {
          50: '#FFF5F5',
          100: '#FFE5D9',
          200: '#FFD1CC',
          300: '#FFB3B3',
          400: '#FF9999',
          500: '#FF6B6B',
          600: '#FF5252',
          700: '#E53E3E',
          800: '#C53030',
          900: '#9B2C2C',
        },
        secondary: {
          50: '#F7F3FF',
          100: '#E0BBE4',
          200: '#D1A3D6',
          300: '#C28BC8',
          400: '#B373BA',
          500: '#A45BAC',
          600: '#95439E',
          700: '#862B90',
          800: '#771382',
          900: '#680074',
        },
        accent: {
          50: '#FFF8F0',
          100: '#FFDFD3',
          200: '#FFC4B3',
          300: '#FFA993',
          400: '#FF8E73',
          500: '#FF7353',
          600: '#E65A3A',
          700: '#CC4121',
          800: '#B32808',
          900: '#9A0F00',
        },
        warm: {
          peach: '#FFE5D9',
          lavender: '#E0BBE4',
          pink: '#FFDFD3',
          cream: '#FFF8F0',
          rose: '#FFB3B3'
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['Poppins', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-gentle': 'bounceGentle 2s infinite',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'warm': '0 4px 20px -2px rgba(255, 107, 107, 0.1)',
        'lavender': '0 4px 20px -2px rgba(224, 187, 228, 0.2)',
      },
      backgroundImage: {
        'gradient-warm': 'linear-gradient(135deg, #FFE5D9 0%, #E0BBE4 100%)',
        'gradient-romantic': 'linear-gradient(135deg, #FFDFD3 0%, #FFB3B3 50%, #E0BBE4 100%)',
      }
    },
  },
  plugins: [],
}
