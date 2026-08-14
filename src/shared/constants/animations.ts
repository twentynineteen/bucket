/**
 * Animation Constants
 *
 * Centralises the timing, easing and variant values read by the components that
 * animate. Every export here has a consumer; twelve that had none were removed under
 * issue #219.
 *
 * `DURATION` and `EASING` are deliberately not exported. They are the vocabulary the
 * constants below are written in, not shared infrastructure: nothing outside this file
 * read them, and leaving them exported made the module look like a design-token API that
 * no component had ever used.
 *
 * Philosophy:
 * - All animations use GPU-accelerated properties (transform, opacity)
 * - Respect prefers-reduced-motion for accessibility
 * - 60fps performance target
 * - Apple-inspired easing curves for smooth, natural motion
 */

// ============================================================================
// INTERNAL VOCABULARY
// ============================================================================

/** Duration values in milliseconds, used to build the constants below. */
const DURATION = {
  instant: 0,
  fast: 150,
  normal: 300,
  slowest: 900
} as const

/** Easing curves used to build the constants below. */
const EASING = {
  easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',

  // Sharp/snappy for quick interactions
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',

  // Legacy support
  legacy: 'ease-in-out'
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
 * Baker Page Animations
 * The two variant sets `ProjectListPanel` reads. Seven further keys (projectRow,
 * detailPanel, scanResults, checkbox, alert, navTab, fileItem) were removed under
 * issue #219: no component read any of them, and their only readers were the Baker
 * tests deleted under #220.
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
  }
} as const
