---
name: ux-animation-guru
description: Scan a file for UX improvement opportunities and implement smooth, elegant animations with TDD methodology. Creates polished, professional user experiences reminiscent of Apple's design philosophy. Works file-by-file, creating reusable animation patterns.
---

# UX Animation Guru

## Overview

Transform static UI components into polished, professional experiences through carefully crafted animations. This skill analyzes components for animation opportunities, writes comprehensive tests first (TDD), and implements smooth, performant animations using Framer Motion and CSS transitions.

## Core Philosophy: Apple-Like Animation Principles

### 1. **Purposeful Motion**

Every animation must have a clear purpose:

- Guide user attention to important changes
- Provide feedback for user actions
- Create smooth transitions between states
- Establish spatial relationships between elements

### 2. **Seamless Performance**

- 60fps target (use GPU-accelerated properties only: `transform`, `opacity`)
- Respect `prefers-reduced-motion` for accessibility
- Keep animations under 600ms (300ms for micro-interactions)
- Test on lower-end devices

### 3. **Natural Physics**

- Use easing curves that mimic real-world motion
- Avoid linear transitions (they feel robotic)
- Default to `ease-out` for entrances, `ease-in` for exits
- Use spring physics for interactive elements

### 4. **Consistency & Reusability**

- All timing/easing values stored in constants
- Shared animation patterns across components
- Predictable behavior builds user confidence

## When to Use This Skill

Invoke this skill when you want to:

- Add animations to a new or existing component
- Improve micro-interactions (hover, focus, active states)
- Implement state transition animations
- Create loading/success/error state animations
- Add list/grid item stagger effects
- Implement scroll-triggered animations
- Ensure animations are accessible and tested

## Workflow: TDD Methodology

### Phase 1: Analysis (Non-Destructive)

1. Read the target file
2. Identify animation opportunities:
   - State changes (loading → success, collapsed → expanded)
   - User interactions (hover, click, focus, drag)
   - List/grid items (stagger, reorder)
   - Page/modal entrances and exits
   - Progress indicators
   - Empty states
3. Generate a detailed report with:
   - Recommended animations
   - Required constants
   - Test specifications
   - Implementation complexity (low/medium/high)

### Phase 2: Test Creation (TDD - Red Phase)

Before writing any animation code:

1. **Create test utilities** (if not exist):

   ```typescript
   // tests/utils/animation-testing.ts
   import { render, waitFor } from '@testing-library/react'

   export const expectElementToHaveAnimation = (element: HTMLElement) => {
     const styles = window.getComputedStyle(element)
     const hasTransition = styles.transition !== 'all 0s ease 0s'
     const hasAnimation = styles.animation !== 'none 0s ease 0s'
     expect(hasTransition || hasAnimation).toBe(true)
   }

   export const expectMotionComponent = (element: HTMLElement) => {
     // Framer Motion adds data-projection-id attribute
     expect(element).toHaveAttribute('data-projection-id')
   }
   ```

2. **Write animation presence tests**:

   ```typescript
   describe('ButtonAnimation', () => {
     it('should have hover animation', async () => {
       const { getByRole } = render(<Button>Click me</Button>)
       const button = getByRole('button')
       expectElementToHaveAnimation(button)
     })
   })
   ```

3. **Write animation constant tests**:

   ```typescript
   import { BUTTON_ANIMATIONS } from '@/constants/animations'

   describe('Animation Constants', () => {
     it('should use defined hover duration', () => {
       expect(BUTTON_ANIMATIONS.hover.duration).toBe(200)
     })
   })
   ```

4. **Write animation lifecycle tests**:

   ```typescript
   it('should animate state change from loading to success', async () => {
     const { rerender, getByTestId } = render(<Status state="loading" />)
     const element = getByTestId('status-indicator')

     rerender(<Status state="success" />)

     await waitFor(() => {
       expect(element).toHaveClass('animate-success')
     })
   })
   ```

5. **Write accessibility tests**:

   ```typescript
   it('should respect prefers-reduced-motion', () => {
     window.matchMedia = vi.fn().mockImplementation(query => ({
       matches: query === '(prefers-reduced-motion: reduce)',
       media: query,
       addEventListener: vi.fn(),
       removeEventListener: vi.fn()
     }))

     const { getByRole } = render(<AnimatedCard />)
     const card = getByRole('article')

     // Should have no animation or reduced animation
     const styles = window.getComputedStyle(card)
     expect(styles.transitionDuration).toBe('0s')
   })
   ```

### Phase 3: Constants Definition

Create/update animation constants in `src/constants/animations.ts`:

```typescript
// Timing constants (milliseconds)
export const DURATION = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 700
} as const

// Easing functions
export const EASING = {
  // Standard curves
  easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',

  // Apple-inspired curves
  appleEase: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  appleSpring: 'cubic-bezier(0.5, 1.8, 0.9, 0.8)',

  // Sharp/snappy
  sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)'
} as const

// Spring physics for Framer Motion
export const SPRING = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  snappy: { type: 'spring', stiffness: 400, damping: 30 },
  bouncy: { type: 'spring', stiffness: 300, damping: 10 }
} as const

// Component-specific animations
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
    duration: DURATION.normal
  }
} as const

export const CARD_ANIMATIONS = {
  enter: {
    duration: DURATION.normal,
    easing: EASING.appleEase,
    from: { opacity: 0, y: 20 },
    to: { opacity: 1, y: 0 }
  },
  hover: {
    elevation: '0 8px 16px rgba(0, 0, 0, 0.1)',
    duration: DURATION.fast
  }
} as const

export const LIST_ANIMATIONS = {
  stagger: {
    delayBetweenItems: 50, // ms
    duration: DURATION.normal
  },
  reorder: {
    duration: DURATION.slow,
    easing: EASING.appleSpring
  }
} as const
```

### Phase 4: Implementation (Green Phase)

Implement animations using the test-driven constants:

#### Framer Motion Pattern (Preferred)

```typescript
import { motion, useReducedMotion } from 'framer-motion'
import { BUTTON_ANIMATIONS, DURATION, EASING } from '@/constants/animations'

export const AnimatedButton: React.FC = ({ children, ...props }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      whileHover={!shouldReduceMotion ? {
        scale: BUTTON_ANIMATIONS.hover.scale
      } : undefined}
      whileTap={!shouldReduceMotion ? {
        scale: BUTTON_ANIMATIONS.press.scale
      } : undefined}
      transition={{
        duration: BUTTON_ANIMATIONS.hover.duration / 1000, // Convert to seconds
        ease: EASING.easeOut
      }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
```

#### CSS Transition Pattern (Lightweight Alternative)

```typescript
import { BUTTON_ANIMATIONS } from '@/constants/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export const Button: React.FC = ({ children, ...props }) => {
  const shouldReduceMotion = useReducedMotion()

  return (
    <button
      className="transition-transform"
      style={{
        transitionDuration: shouldReduceMotion
          ? '0ms'
          : `${BUTTON_ANIMATIONS.hover.duration}ms`,
        transitionTimingFunction: BUTTON_ANIMATIONS.hover.easing
      }}
      {...props}
    >
      {children}
    </button>
  )
}
```

### Phase 5: Verification & Polish

1. Run tests: `npm run test` (all must pass)
2. Visual QA in browser with DevTools
3. Test with `prefers-reduced-motion` enabled
4. Check performance (should be 60fps)
5. Update documentation if new patterns emerged

## Animation Categories & Patterns

### 1. Micro-Interactions

Small, delightful responses to user actions:

**Hover Effects**:

```typescript
<motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
  {content}
</motion.div>
```

**Button Press**:

```typescript
<motion.button
  whileTap={{ scale: 0.95 }}
  transition={{ duration: 0.1 }}
>
  Click me
</motion.button>
```

**Focus States**:

```typescript
<motion.input
  whileFocus={{
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
  }}
  transition={{ duration: 0.2 }}
/>
```

### 2. State Transitions

Smooth changes between component states:

**Loading → Success**:

```typescript
<AnimatePresence mode="wait">
  {isLoading ? (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Spinner />
    </motion.div>
  ) : (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      <CheckIcon />
    </motion.div>
  )}
</AnimatePresence>
```

**Expand/Collapse**:

```typescript
<motion.div
  animate={{ height: isExpanded ? 'auto' : 0 }}
  transition={{ duration: 0.3, ease: 'easeInOut' }}
  style={{ overflow: 'hidden' }}
>
  {content}
</motion.div>
```

### 3. List Animations

Staggered entrances and reordering:

**Staggered List Items**:

```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

<motion.ul variants={containerVariants} initial="hidden" animate="show">
  {items.map(item => (
    <motion.li key={item.id} variants={itemVariants}>
      {item.content}
    </motion.li>
  ))}
</motion.ul>
```

### 4. Page/Modal Transitions

**Modal Enter/Exit**:

```typescript
<AnimatePresence>
  {isOpen && (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 flex items-center justify-center"
      >
        <div className="bg-white rounded-lg p-6">
          {content}
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

### 5. Progress Indicators

**Smooth Progress Bar**:

```typescript
<motion.div
  className="h-2 bg-primary"
  initial={{ width: 0 }}
  animate={{ width: `${progress}%` }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
/>
```

**Loading Spinner with Spring**:

```typescript
<motion.div
  animate={{ rotate: 360 }}
  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
>
  <SpinnerIcon />
</motion.div>
```

### 6. Scroll-Based Animations

**Fade In on Scroll**:

```typescript
import { useInView } from 'framer-motion'
import { useRef } from 'react'

const ref = useRef(null)
const isInView = useInView(ref, { once: true, margin: '-100px' })

<motion.div
  ref={ref}
  initial={{ opacity: 0, y: 50 }}
  animate={isInView ? { opacity: 1, y: 0 } : {}}
  transition={{ duration: 0.5 }}
>
  {content}
</motion.div>
```

### 7. Gesture-Based Animations

**Drag and Drop Feedback**:

```typescript
<motion.div
  drag
  dragConstraints={{ left: 0, right: 300, top: 0, bottom: 300 }}
  dragElastic={0.1}
  whileDrag={{ scale: 1.1, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
>
  Drag me
</motion.div>
```

## Accessibility Requirements

### 1. Respect prefers-reduced-motion

Always implement:

```typescript
// Hook: src/hooks/useReducedMotion.ts
import { useEffect, useState } from 'react'

export const useReducedMotion = () => {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setShouldReduceMotion(mediaQuery.matches)

    const handleChange = () => setShouldReduceMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return shouldReduceMotion
}
```

Usage:

```typescript
const shouldReduceMotion = useReducedMotion()

<motion.div
  animate={shouldReduceMotion ? {} : { x: 100 }}
  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5 }}
>
  {content}
</motion.div>
```

### 2. Focus Management

Ensure focus is visible during animations:

```typescript
<motion.button
  whileHover={{ scale: 1.05 }}
  className="focus-visible:ring-2 focus-visible:ring-primary"
>
  Click me
</motion.button>
```

### 3. WCAG 2.2.2 Compliance

For animations longer than 5 seconds, provide pause/stop controls.

## Performance Optimization

### GPU-Accelerated Properties Only

Use only these properties for 60fps:

- `transform` (translate, scale, rotate)
- `opacity`
- `filter` (use sparingly)

**Avoid**:

- `width`, `height` (triggers layout)
- `top`, `left` (triggers layout)
- `margin`, `padding` (triggers layout)

### Use will-change Sparingly

```typescript
<motion.div
  style={{ willChange: 'transform' }}
  animate={{ x: 100 }}
>
  {content}
</motion.div>
```

### Lazy Load Framer Motion

For components not immediately visible:

```typescript
import { lazy, Suspense } from 'react'

const AnimatedComponent = lazy(() => import('./AnimatedComponent'))

<Suspense fallback={<StaticVersion />}>
  <AnimatedComponent />
</Suspense>
```

## Testing Strategy

### Unit Tests

Test animation presence and constants:

```typescript
import { render } from '@testing-library/react'
import { AnimatedButton } from './AnimatedButton'
import { BUTTON_ANIMATIONS } from '@/constants/animations'

describe('AnimatedButton', () => {
  it('should apply hover animation', () => {
    const { getByRole } = render(<AnimatedButton>Click</AnimatedButton>)
    const button = getByRole('button')

    // Check for Framer Motion attributes
    expect(button).toHaveAttribute('data-projection-id')
  })

  it('should use defined animation duration', () => {
    expect(BUTTON_ANIMATIONS.hover.duration).toBe(150)
  })
})
```

### Integration Tests

Test animation lifecycle with user interactions:

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react'

describe('StateTransitionAnimation', () => {
  it('should animate from loading to success state', async () => {
    const { getByTestId, rerender } = render(
      <StatusIndicator status="loading" />
    )

    rerender(<StatusIndicator status="success" />)

    await waitFor(() => {
      const indicator = getByTestId('status')
      expect(indicator).toHaveClass('success')
    })
  })
})
```

### Accessibility Tests

```typescript
describe('Animation Accessibility', () => {
  it('should disable animations when prefers-reduced-motion is set', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    })

    const { getByRole } = render(<AnimatedCard />)
    const card = getByRole('article')

    const styles = window.getComputedStyle(card)
    expect(styles.transitionDuration).toBe('0s')
  })
})
```

## Deliverables

When this skill completes, you will have:

1. **Test suite** with comprehensive animation coverage
2. **Updated animation constants** with new patterns
3. **Animated component** with Framer Motion integration
4. **Accessibility support** (prefers-reduced-motion, focus management)
5. **Performance verified** (60fps, GPU-accelerated only)
6. **Documentation** of new animation patterns (if novel)
7. **Reference implementation** that can guide other components

## Example: Complete Workflow

Let's say you invoke this skill on `ProjectFileList.tsx`:

### Analysis Output

```
Animation Opportunities Found:
1. List Items - Staggered entrance (MEDIUM complexity)
2. Delete Button - Hover/press feedback (LOW complexity)
3. Camera Selector - Focus state animation (LOW complexity)
4. File upload - Loading state animation (MEDIUM complexity)

Recommended Constants:
- FILE_LIST_ANIMATIONS.stagger
- FILE_LIST_ANIMATIONS.itemEnter
- FILE_LIST_ANIMATIONS.deleteButton

Tests Required: 8
Estimated Implementation: 30 minutes
```

### Tests Created (Red Phase)

- `tests/unit/ProjectFileList.animations.test.tsx`
- `tests/integration/ProjectFileList.interaction.test.tsx`

### Constants Added

```typescript
export const FILE_LIST_ANIMATIONS = {
  stagger: {
    delayBetweenItems: 50,
    duration: DURATION.normal
  },
  itemEnter: {
    from: { opacity: 0, x: -20 },
    to: { opacity: 1, x: 0 }
  },
  deleteButton: {
    hover: { scale: 1.1, color: '#ef4444' },
    press: { scale: 0.9 }
  }
}
```

### Implementation (Green Phase)

Component updated with Framer Motion, all tests passing, accessibility verified.

## Notes

- Always run `npm run test` before and after implementation
- Respect the project's existing patterns (see `src/constants/animations.ts`)
- When in doubt, prefer subtle over flashy
- Every animation must improve UX, not just look cool
- Document any new animation patterns for future reference
