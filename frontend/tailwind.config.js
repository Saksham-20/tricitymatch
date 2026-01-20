import tailwindcssAnimate from "tailwindcss-animate"

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Royal Elegance Color Palette
      colors: {
        // CSS Variable-based colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        
        // Primary - Burgundy Rose
        primary: {
          DEFAULT: "#8B2346",
          50: "#FDF2F5",
          100: "#F8E8EC",
          200: "#F0CDD7",
          300: "#E5A3B8",
          400: "#D66E8E",
          500: "#8B2346",
          600: "#6B1D3A",
          700: "#55172E",
          800: "#401123",
          900: "#2A0B17",
          foreground: "hsl(var(--primary-foreground))",
        },
        
        // Secondary - Slate Gray
        secondary: {
          DEFAULT: "#5A5A5A",
          50: "#F5F5F5",
          100: "#E8E8E8",
          200: "#D4D4D4",
          300: "#A3A3A3",
          400: "#737373",
          500: "#5A5A5A",
          600: "#404040",
          700: "#2D2D2D",
          800: "#1A1A1A",
          900: "#0D0D0D",
          foreground: "hsl(var(--secondary-foreground))",
        },
        
        // Gold - Royal Gold
        gold: {
          DEFAULT: "#C9A227",
          50: "#FEFCF3",
          100: "#FDF6E3",
          200: "#F9EABC",
          300: "#F2D88A",
          400: "#E8C34A",
          500: "#C9A227",
          600: "#B8941F",
          700: "#96781A",
          800: "#745C14",
          900: "#52410E",
        },
        
        // Neutral - Clean grays
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E8E8E8',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#8B8B8B',
          600: '#5A5A5A',
          700: '#404040',
          800: '#2D2D2D',
          900: '#1A1A1A',
        },
        
        // Status Colors
        success: {
          DEFAULT: "#2E7D32",
          light: "#E8F5E9",
          50: "#E8F5E9",
          100: "#C8E6C9",
          500: "#2E7D32",
          600: "#256427",
        },
        
        info: {
          DEFAULT: "#1565C0",
          light: "#E3F2FD",
          500: "#1565C0",
        },
        
        warning: {
          DEFAULT: "#F57C00",
          light: "#FFF3E0",
          500: "#F57C00",
        },
        
        destructive: {
          DEFAULT: "#C62828",
          light: "#FFEBEE",
          foreground: "hsl(var(--destructive-foreground))",
        },
        
        // Legacy compatibility
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      
      // Font families
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      
      // Font sizes with proper line heights
      fontSize: {
        'xs': ['12px', { lineHeight: '1.5', letterSpacing: '0.02em' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'base': ['16px', { lineHeight: '1.6' }],
        'lg': ['18px', { lineHeight: '1.6' }],
        'xl': ['20px', { lineHeight: '1.5' }],
        '2xl': ['24px', { lineHeight: '1.4' }],
        '3xl': ['30px', { lineHeight: '1.3' }],
        '4xl': ['36px', { lineHeight: '1.2' }],
        '5xl': ['48px', { lineHeight: '1.1' }],
        '6xl': ['56px', { lineHeight: '1.1' }],
      },
      
      // Spacing
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      // Border radius
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'xl': '0.875rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      
      // Box shadows - Burgundy tinted
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(139, 35, 70, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(139, 35, 70, 0.1), 0 1px 2px 0 rgba(139, 35, 70, 0.06)',
        'md': '0 4px 6px -1px rgba(139, 35, 70, 0.1), 0 2px 4px -1px rgba(139, 35, 70, 0.06)',
        'lg': '0 10px 15px -3px rgba(139, 35, 70, 0.1), 0 4px 6px -2px rgba(139, 35, 70, 0.05)',
        'xl': '0 20px 25px -5px rgba(139, 35, 70, 0.1), 0 10px 10px -5px rgba(139, 35, 70, 0.04)',
        '2xl': '0 25px 50px -12px rgba(139, 35, 70, 0.25)',
        'burgundy': '0 10px 30px rgba(139, 35, 70, 0.2)',
        'burgundy-lg': '0 20px 40px rgba(139, 35, 70, 0.25)',
        'gold': '0 10px 30px rgba(201, 162, 39, 0.2)',
        'gold-lg': '0 20px 40px rgba(201, 162, 39, 0.25)',
        'card': '0 4px 20px rgba(139, 35, 70, 0.08)',
        'card-hover': '0 8px 30px rgba(139, 35, 70, 0.15)',
      },
      
      // Keyframes for animations
      keyframes: {
        // Accordion
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Shimmer loading
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Fade in up
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Fade in down
        "fade-in-down": {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Fade in
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Scale in
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Slide in right
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // Slide in left
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // Pulse soft
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        // Float
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        // Glow
        "glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(139, 35, 70, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(139, 35, 70, 0.6)" },
        },
        // Heart pulse
        "heart-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" },
        },
        // Shake
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-5px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(5px)" },
        },
        // Bounce in
        "bounce-in": {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Gradient shift
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        // Typing dots
        "typing-bounce": {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-4px)" },
        },
        // Spin slow
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // Confetti
        "confetti": {
          "0%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(-500px) rotate(720deg)", opacity: "0" },
        },
        // Star sparkle
        "sparkle": {
          "0%, 100%": { opacity: "0", transform: "scale(0)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
      },
      
      // Animations
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer": "shimmer 2s infinite linear",
        "fade-in-up": "fade-in-up 0.5s ease-out",
        "fade-in-down": "fade-in-down 0.5s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s infinite",
        "float": "float 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite",
        "heart-pulse": "heart-pulse 0.3s ease-in-out",
        "shake": "shake 0.5s ease-in-out",
        "bounce-in": "bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "gradient-shift": "gradient-shift 5s ease infinite",
        "typing-bounce": "typing-bounce 1.4s infinite ease-in-out",
        "spin-slow": "spin-slow 3s linear infinite",
        "confetti": "confetti 3s ease-out forwards",
        "sparkle": "sparkle 0.6s ease-in-out",
      },
      
      // Backdrop blur
      backdropBlur: {
        xs: '2px',
      },
      
      // Transitions
      transitionDuration: {
        '400': '400ms',
      },
      
      // Z-index
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
