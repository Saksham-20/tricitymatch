/**
 * Framer Motion Animation Variants for TricityMatch
 * Royal Elegance Theme - Matrimony Platform
 */

// ===============================================
// PAGE TRANSITIONS
// ===============================================

export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    }
  },
};

export const pageSlide = {
  initial: { opacity: 0, x: 20 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    }
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: {
      duration: 0.3,
    }
  },
};

// ===============================================
// CONTAINER WITH STAGGER CHILDREN
// ===============================================

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

export const staggerContainerFast = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

// ===============================================
// FADE ANIMATIONS
// ===============================================

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.3 }
  },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exit: { 
    opacity: 0, 
    y: 20,
    transition: { duration: 0.3 }
  },
};

export const fadeInDown = {
  initial: { opacity: 0, y: -30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  },
};

export const fadeInLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  },
};

export const fadeInRight = {
  initial: { opacity: 0, x: 30 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  },
};

// ===============================================
// SCALE ANIMATIONS
// ===============================================

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.2 }
  },
};

export const scaleInBounce = {
  initial: { opacity: 0, scale: 0.3 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 20,
    }
  },
};

export const popIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { 
      type: "spring",
      stiffness: 400,
      damping: 25,
    }
  },
};

// ===============================================
// CARD ANIMATIONS
// ===============================================

export const cardHover = {
  rest: { 
    scale: 1, 
    y: 0,
    boxShadow: "0 4px 20px rgba(139, 35, 70, 0.08)",
  },
  hover: { 
    scale: 1.02, 
    y: -4,
    boxShadow: "0 8px 30px rgba(139, 35, 70, 0.15)",
    transition: { duration: 0.3, ease: "easeOut" }
  },
  tap: { 
    scale: 0.98,
    transition: { duration: 0.1 }
  },
};

export const profileCardVariant = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.2 }
  },
  hover: {
    y: -8,
    boxShadow: "0 12px 40px rgba(139, 35, 70, 0.18)",
    transition: { duration: 0.3 }
  },
};

// ===============================================
// BUTTON ANIMATIONS
// ===============================================

export const buttonTap = {
  tap: { scale: 0.97 },
  hover: { scale: 1.02 },
};

export const buttonPrimary = {
  rest: { 
    scale: 1,
    boxShadow: "0 4px 15px rgba(139, 35, 70, 0.25)",
  },
  hover: { 
    scale: 1.02,
    y: -2,
    boxShadow: "0 8px 25px rgba(139, 35, 70, 0.35)",
    transition: { duration: 0.2 }
  },
  tap: { 
    scale: 0.97,
    transition: { duration: 0.1 }
  },
};

export const heartPulse = {
  rest: { scale: 1 },
  hover: { 
    scale: 1.1,
    transition: { duration: 0.2 }
  },
  tap: { 
    scale: [1, 1.3, 1],
    transition: { duration: 0.3 }
  },
};

// ===============================================
// NAVIGATION ANIMATIONS
// ===============================================

export const navbarScroll = {
  visible: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 4px 20px rgba(139, 35, 70, 0.08)",
  },
  hidden: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(8px)",
    boxShadow: "none",
  },
};

export const mobileMenuVariant = {
  closed: { 
    x: "100%",
    opacity: 0,
    transition: { duration: 0.3, ease: "easeIn" }
  },
  open: { 
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut" }
  },
};

export const menuItemVariant = {
  closed: { opacity: 0, x: 20 },
  open: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3 }
  },
};

export const dropdownVariant = {
  closed: { 
    opacity: 0, 
    y: -10,
    scale: 0.95,
    transition: { duration: 0.15 }
  },
  open: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" }
  },
};

// ===============================================
// FORM ANIMATIONS
// ===============================================

export const inputFocus = {
  rest: { 
    borderColor: "#E8E8E8",
    boxShadow: "none",
  },
  focus: { 
    borderColor: "#8B2346",
    boxShadow: "0 0 0 4px rgba(139, 35, 70, 0.1)",
    transition: { duration: 0.2 }
  },
};

export const formStepTransition = {
  initial: { opacity: 0, x: 50 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    x: -50,
    transition: { duration: 0.3, ease: "easeIn" }
  },
};

export const shakeAnimation = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.5 }
  },
};

export const checkmarkAnimation = {
  initial: { pathLength: 0, opacity: 0 },
  animate: { 
    pathLength: 1, 
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" }
  },
};

// ===============================================
// LOADING ANIMATIONS
// ===============================================

export const shimmer = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

export const pulseLoader = {
  animate: {
    scale: [1, 1.1, 1],
    opacity: [0.7, 1, 0.7],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const spinnerVariant = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

// ===============================================
// CHAT ANIMATIONS
// ===============================================

export const messageBubble = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" }
  },
};

export const typingIndicator = {
  animate: {
    y: [0, -4, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const sendButtonFly = {
  initial: { x: 0, y: 0 },
  animate: { 
    x: 100, 
    y: -100, 
    opacity: 0,
    transition: { duration: 0.4 }
  },
};

// ===============================================
// SUCCESS/CELEBRATION ANIMATIONS
// ===============================================

export const celebrationPop = {
  initial: { scale: 0, rotate: -180 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: { 
      type: "spring",
      stiffness: 200,
      damping: 15,
    }
  },
};

export const confettiPiece = {
  animate: (custom) => ({
    y: [-20, -500],
    x: [0, custom.x],
    rotate: [0, custom.rotate],
    opacity: [1, 0],
    transition: {
      duration: 3,
      ease: "easeOut",
    },
  }),
};

export const badgeReveal = {
  initial: { scale: 0, opacity: 0 },
  animate: { 
    scale: [0, 1.2, 1], 
    opacity: 1,
    transition: { 
      duration: 0.5,
      times: [0, 0.7, 1],
    }
  },
};

export const goldenGlow = {
  animate: {
    boxShadow: [
      "0 0 20px rgba(201, 162, 39, 0.3)",
      "0 0 40px rgba(201, 162, 39, 0.6)",
      "0 0 20px rgba(201, 162, 39, 0.3)",
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ===============================================
// SCROLL ANIMATIONS (for use with useInView)
// ===============================================

export const scrollReveal = {
  hidden: { opacity: 0, y: 50 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  },
};

export const scrollRevealLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  },
};

export const scrollRevealRight = {
  hidden: { opacity: 0, x: 50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  },
};

export const scrollRevealScale = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  },
};

// ===============================================
// COMPATIBILITY METER
// ===============================================

export const compatibilityFill = (percentage) => ({
  initial: { width: 0 },
  animate: { 
    width: `${percentage}%`,
    transition: { 
      duration: 1.5, 
      ease: "easeOut",
      delay: 0.3,
    }
  },
});

export const counterAnimation = (end) => ({
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { duration: 0.3 }
  },
});

// ===============================================
// IMAGE GALLERY
// ===============================================

export const imageZoom = {
  rest: { scale: 1 },
  hover: { 
    scale: 1.05,
    transition: { duration: 0.4, ease: "easeOut" }
  },
};

export const lightboxOverlay = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: { duration: 0.3 }
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.2 }
  },
};

export const lightboxImage = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    transition: { duration: 0.2 }
  },
};

// ===============================================
// UTILITY FUNCTIONS
// ===============================================

/**
 * Create stagger delay for children
 * @param {number} index - Child index
 * @param {number} baseDelay - Base delay in seconds
 * @returns {object} Animation with delay
 */
export const createStaggerDelay = (index, baseDelay = 0.1) => ({
  animate: {
    transition: {
      delay: index * baseDelay,
    },
  },
});

/**
 * Create custom spring animation
 * @param {number} stiffness 
 * @param {number} damping 
 * @returns {object} Spring transition config
 */
export const createSpring = (stiffness = 300, damping = 20) => ({
  type: "spring",
  stiffness,
  damping,
});

/**
 * Default transition presets
 */
export const transitions = {
  fast: { duration: 0.15 },
  normal: { duration: 0.3 },
  slow: { duration: 0.5 },
  spring: { type: "spring", stiffness: 300, damping: 20 },
  bounce: { type: "spring", stiffness: 400, damping: 10 },
  smooth: { ease: [0.25, 0.46, 0.45, 0.94] },
};
