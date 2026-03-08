/**
 * Animation Constants
 *
 * Centralizes all timing, easing, and animation values for consistent,
 * professional animations across the application.
 *
 * Philosophy:
 * - All animations use GPU-accelerated properties (transform, opacity)
 * - Respect prefers-reduced-motion for accessibility
 * - 60fps performance target
 * - Apple-inspired easing curves for smooth, natural motion
 */

// ============================================================================
// CORE TIMING VALUES
// ============================================================================

/**
 * Standard duration values (in milliseconds)
 * Use these instead of magic numbers for consistency
 */
export const DURATION = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 700,
  slowest: 900
} as const

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

/**
 * Easing curves for natural, polished animations
 * Apple-inspired timing functions
 */
export const EASING = {
  // Standard Material Design curves
  easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',

  // Apple-inspired curves (smoother, more refined)
  appleEase: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  appleSpring: 'cubic-bezier(0.5, 1.8, 0.9, 0.8)',

  // Sharp/snappy for quick interactions
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',

  // Legacy support
  legacy: 'ease-in-out'
} as const

/**
 * Spring physics configurations for Framer Motion
 * Use for natural, bouncy animations
 */
export const SPRING = {
  gentle: { type: 'spring' as const, stiffness: 120, damping: 14 },
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
  bouncy: { type: 'spring' as const, stiffness: 300, damping: 10 }
} as const

// ============================================================================
// COMPONENT-SPECIFIC ANIMATIONS
// ============================================================================

/**
 * BuildProject Step Card Animations
 * Used for collapsible step cards in the project creation workflow
 */
export const STEP_CARD_ANIMATION = {
  // Heights for collapse/expand animation
  collapsedHeight: '60px',
  expandedHeight: '1000px',

  // Padding for collapse/expand animation
  collapsedPadding: '12px 16px',
  expandedPadding: '16px',

  // Animation timing
  duration: DURATION.slowest,
  easing: EASING.legacy
} as const

/**
 * Success Section Animations
 * Used when project creation completes successfully
 */
export const SUCCESS_ANIMATION = {
  // Delay before showing success section (allows collapse animation to be visible)
  delay: 100,

  // Success section fade-in animation
  fadeInDuration: DURATION.slow,
  fadeInEasing: EASING.easeOut
} as const

/**
 * File List Animations
 * Used for animating individual file items in lists
 */
export const FILE_LIST_ANIMATION = {
  // Individual file item fade-in animation
  name: 'fadeInUp',
  duration: DURATION.normal,
  easing: EASING.easeOut,
  staggerDelay: 50, // Delay between each item (ms)

  // Framer Motion variants
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }
} as const

/**
 * Button Animations
 * Micro-interactions for button hover/press states
 */
export const BUTTON_ANIMATIONS = {
  hover: {
    scale: 1.02,
    duration: DURATION.fast,
    easing: EASING.easeOut
  },
  press: {
    scale: 0.98,
    duration: DURATION.instant,
    easing: EASING.sharp
  },
  disabled: {
    opacity: 0.5,
    duration: DURATION.normal,
    easing: EASING.easeOut
  },
  // Lift effect for premium buttons (gradient CTAs)
  lift: {
    y: -3, // Lift up 3px
    duration: DURATION.fast,
    easing: EASING.easeOut,
    shadowFrom: 'md', // Tailwind shadow class
    shadowTo: 'lg' // Grows to larger shadow
  },
  // Glow/shine effect for gradient buttons
  glow: {
    duration: DURATION.normal,
    easing: EASING.easeOut,
    brightnessFrom: 1.0,
    brightnessTo: 1.1,
    saturateFrom: 1.0,
    saturateTo: 1.2,
    scale: 1.03
  }
} as const

/**
 * Card Animations
 * Used for card components (hover, entrance, exit)
 */
export const CARD_ANIMATIONS = {
  enter: {
    duration: DURATION.normal,
    easing: EASING.appleEase,
    from: { opacity: 0, y: 20 },
    to: { opacity: 1, y: 0 }
  },
  hover: {
    elevation: '0 8px 16px rgba(0, 0, 0, 0.1)',
    scale: 1.01,
    duration: DURATION.fast,
    easing: EASING.easeOut
  },
  exit: {
    duration: DURATION.fast,
    easing: EASING.easeIn,
    to: { opacity: 0, scale: 0.95 }
  }
} as const

/**
 * Modal/Dialog Animations
 * Entry and exit animations for modals, dialogs, sheets
 */
export const MODAL_ANIMATIONS = {
  backdrop: {
    enter: { opacity: 0 },
    show: { opacity: 1 },
    exit: { opacity: 0 },
    duration: DURATION.normal
  },
  content: {
    enter: { opacity: 0, scale: 0.95, y: 20 },
    show: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
    transition: SPRING.snappy
  }
} as const

/**
 * Progress Indicator Animations
 * Used for progress bars, loading spinners, etc.
 */
export const PROGRESS_ANIMATIONS = {
  bar: {
    duration: DURATION.normal,
    easing: EASING.easeOut
  },
  spinner: {
    duration: 1000, // 1 full rotation per second
    easing: 'linear' as const
  },
  pulse: {
    duration: 1500,
    easing: EASING.easeInOut
  }
} as const

/**
 * Toast/Notification Animations
 * Entry and exit animations for toasts
 */
export const TOAST_ANIMATIONS = {
  slideIn: {
    from: { x: '100%', opacity: 0 },
    to: { x: 0, opacity: 1 },
    duration: DURATION.normal,
    easing: EASING.appleEase
  },
  slideOut: {
    to: { x: '100%', opacity: 0 },
    duration: DURATION.fast,
    easing: EASING.easeIn
  }
} as const

/**
 * Input/Form Animations
 * Focus states, validation feedback, etc.
 */
export const INPUT_ANIMATIONS = {
  focus: {
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
    duration: DURATION.fast,
    easing: EASING.easeOut
  },
  error: {
    shake: {
      keyframes: [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-10px)' },
        { transform: 'translateX(10px)' },
        { transform: 'translateX(-10px)' },
        { transform: 'translateX(10px)' },
        { transform: 'translateX(0)' }
      ],
      duration: 400
    }
  },
  success: {
    borderColor: '#10b981',
    duration: DURATION.fast
  }
} as const

/**
 * Skeleton/Loading State Animations
 * Pulse effects for loading placeholders
 */
export const SKELETON_ANIMATIONS = {
  pulse: {
    keyframes: [{ opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }],
    duration: 1500,
    easing: EASING.easeInOut,
    iterationCount: 'infinite' as const
  }
} as const

/**
 * Scroll-Based Animations
 * Fade in on scroll, parallax effects, etc.
 */
export const SCROLL_ANIMATIONS = {
  fadeIn: {
    from: { opacity: 0, y: 50 },
    to: { opacity: 1, y: 0 },
    duration: DURATION.slow,
    easing: EASING.appleEase,
    threshold: 0.1 // IntersectionObserver threshold
  },
  parallax: {
    speed: 0.5, // Multiplier for scroll speed
    easing: EASING.easeOut
  }
} as const

/**
 * Drag & Drop Animations
 * Feedback for draggable elements
 */
export const DRAG_ANIMATIONS = {
  lift: {
    scale: 1.05,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    duration: DURATION.fast,
    easing: EASING.easeOut
  },
  drop: {
    scale: 1,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    duration: DURATION.normal,
    easing: SPRING.gentle
  },
  dragConstraints: {
    elastic: 0.1 // Resistance at boundaries
  }
} as const

/**
 * Baker Page Animations
 * Animations specific to the Baker workflow page
 */
export const BAKER_ANIMATIONS = {
  // Project list stagger entrance
  projectList: {
    container: {
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
      }
    },
    item: {
      hidden: { opacity: 0, y: 10 },
      show: {
        opacity: 1,
        y: 0,
        transition: {
          duration: DURATION.normal / 1000,
          ease: [0.25, 0.1, 0.25, 1] // appleEase as array
        }
      }
    }
  },

  // Project selection row hover
  projectRow: {
    hover: {
      scale: 1.005,
      duration: DURATION.fast,
      easing: EASING.easeOut
    },
    selected: {
      duration: DURATION.normal,
      easing: EASING.easeOut
    }
  },

  // Detail panel transition
  detailPanel: {
    enter: {
      opacity: 0,
      x: 20
    },
    show: {
      opacity: 1,
      x: 0,
      transition: {
        duration: DURATION.normal / 1000,
        ease: [0.25, 0.1, 0.25, 1] // appleEase as array
      }
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: {
        duration: DURATION.fast / 1000
      }
    }
  },

  // Status badge pulse (for warnings)
  statusBadge: {
    pulse: {
      scale: [1, 1.05, 1] as number[],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: [0.4, 0.0, 0.2, 1] // easeInOut as array
      }
    }
  },

  // Scan results celebration
  scanResults: {
    enter: {
      opacity: 0,
      scale: 0.95,
      y: 20
    },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 25
      }
    }
  },

  // Checkbox check animation
  checkbox: {
    check: {
      pathLength: [0, 1],
      duration: DURATION.normal,
      ease: [0.25, 0.1, 0.25, 1] // appleEase as array
    },
    scale: {
      checked: 1.1,
      unchecked: 1,
      duration: DURATION.fast
    }
  },

  // Alert/toast slide-in
  alert: {
    enter: {
      x: 400,
      opacity: 0
    },
    show: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 30
      }
    },
    exit: {
      x: 400,
      opacity: 0,
      transition: {
        duration: DURATION.fast / 1000
      }
    }
  },

  // Navigation tabs
  navTab: {
    hover: {
      scale: 1.02,
      duration: DURATION.fast,
      easing: EASING.easeOut
    },
    active: {
      duration: DURATION.normal,
      easing: EASING.easeOut
    }
  },

  // File list items
  fileItem: {
    hover: {
      backgroundColor: 'hsl(var(--accent) / 0.5)',
      scale: 1.002,
      duration: DURATION.fast
    }
  }
} as const
