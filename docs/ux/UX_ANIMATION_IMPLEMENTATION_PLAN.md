# UX Animation Implementation Plan

**Created**: December 9, 2025
**Skill**: ux-animation-guru
**Methodology**: Test-Driven Development (TDD)
**Goal**: Transform the Bucket application into a polished, professional experience with smooth, elegant animations reminiscent of Apple's design philosophy.

---

## Table of Contents

1. [Overview](#overview)
2. [Guiding Principles](#guiding-principles)
3. [Phase Structure](#phase-structure)
4. [Phase 1: Foundation & BuildProject Micro-interactions](#phase-1-foundation--buildproject-micro-interactions)
5. [Phase 2: BuildProject State Transitions](#phase-2-buildproject-state-transitions)
6. [Phase 3: BuildProject List Animations](#phase-3-buildproject-list-animations)
7. [Phase 4: Global Component Library](#phase-4-global-component-library)
8. [Phase 5: Modal & Dialog Animations](#phase-5-modal--dialog-animations)
9. [Phase 6: Advanced Interactions](#phase-6-advanced-interactions)
10. [Phase 7: Polish & Performance Optimization](#phase-7-polish--performance-optimization)
11. [Testing Strategy](#testing-strategy)
12. [Success Metrics](#success-metrics)
13. [Reference Implementation](#reference-implementation)

---

## Overview

This plan outlines a **7-phase approach** to implementing animations across the Bucket application. Each phase:

- Follows **TDD methodology** (write tests first, then implementation)
- Uses the **ux-animation-guru skill** for consistency
- Builds on previous phases (each component can be reference for others)
- Maintains **60fps performance** and **accessibility compliance**
- Uses **reusable constants** from `src/constants/animations.ts`

### Timeline Approach

**No time estimates**. Each phase is marked complete when:

- ✅ All tests pass
- ✅ Visual QA verified in browser
- ✅ Accessibility requirements met (prefers-reduced-motion)
- ✅ Performance verified (60fps, GPU-accelerated only)
- ✅ Documentation updated

---

## Guiding Principles

### 1. Purposeful Motion

Every animation must have a clear reason:

- Guide user attention to important changes
- Provide feedback for user actions
- Create smooth transitions between states
- Establish spatial relationships

### 2. Apple-Like Quality

- Natural, physics-based motion (spring animations)
- Subtle, refined (not flashy)
- Fast micro-interactions (150ms)
- Smooth state changes (300-500ms)

### 3. Performance First

- GPU-accelerated properties only: `transform`, `opacity`
- 60fps target on all devices
- Lazy-load Framer Motion where appropriate
- Respect `prefers-reduced-motion`

### 4. Accessibility Non-Negotiable

- All animations respect `prefers-reduced-motion`
- Focus remains visible during animations
- No animation longer than 600ms without user control
- WCAG 2.1 Level AAA compliance

### 5. Test-Driven Development

- **Red**: Write failing tests first
- **Green**: Implement minimal code to pass
- **Refactor**: Clean up, extract constants
- **Verify**: Visual QA + accessibility check

---

## Phase Structure

Each phase follows this workflow:

```
1. Analyze Component
   ↓
2. Write Tests (RED phase)
   - Animation presence tests
   - Animation constant tests
   - Lifecycle tests
   - Accessibility tests
   ↓
3. Run Tests (should fail)
   ↓
4. Define/Update Constants
   ↓
5. Implement Animations (GREEN phase)
   ↓
6. Run Tests (should pass)
   ↓
7. Visual QA
   ↓
8. Document Patterns
   ↓
9. Mark Phase Complete
```

---

## Phase 1: Foundation & BuildProject Micro-interactions

**Goal**: Establish foundation and add subtle micro-interactions to BuildProject page components.

### Components in Scope

1. ✅ `src/hooks/useReducedMotion.ts` (CREATED)
2. ✅ `tests/utils/animation-testing.ts` (CREATED)
3. ✅ `src/constants/animations.ts` (EXPANDED)
4. `src/pages/BuildProject/FolderSelector.tsx`
5. `src/pages/BuildProject/ProjectInputs.tsx`
6. `src/components/ui/button.tsx`
7. `src/components/ui/input.tsx`

### Tasks

#### 1.1: Foundation (COMPLETED ✅)

- [x] Install framer-motion
- [x] Create `useReducedMotion` hook
- [x] Create animation testing utilities
- [x] Expand animation constants

#### 1.2: Button Micro-interactions

**File**: `src/components/ui/button.tsx`

**Tests to Write**:

```typescript
// tests/unit/components/ui/button.test.tsx
describe('Button Animations', () => {
  it('should apply hover animation on mouse enter', async () => {
    // Test hover scale effect
  })

  it('should apply press animation on mouse down', async () => {
    // Test press scale effect
  })

  it('should respect prefers-reduced-motion', () => {
    // Test no animation when reduced motion is enabled
  })

  it('should use BUTTON_ANIMATIONS constants', () => {
    // Verify constants are used
  })
})
```

**Animation Opportunities**:

- Hover: subtle scale (1.02) with shadow lift
- Press: scale down (0.98) for tactile feedback
- Disabled: opacity fade

**Implementation Approach**:

- Wrap button with `motion.button` from Framer Motion
- Use `useReducedMotion` hook
- Apply `BUTTON_ANIMATIONS` constants

#### 1.3: Input Focus States

**File**: `src/components/ui/input.tsx`

**Tests to Write**:

```typescript
// tests/unit/components/ui/input.test.tsx
describe('Input Animations', () => {
  it('should animate focus state', async () => {
    // Test border color and shadow change
  })

  it('should animate error state with shake', async () => {
    // Test shake animation on validation error
  })

  it('should animate success state', async () => {
    // Test success border color change
  })

  it('should respect prefers-reduced-motion', () => {
    // Test instant transitions when reduced motion
  })
})
```

**Animation Opportunities**:

- Focus: border color change + subtle shadow
- Error: shake animation + red border
- Success: green border fade-in

#### 1.4: FolderSelector Button

**File**: `src/pages/BuildProject/FolderSelector.tsx`

**Tests to Write**:

```typescript
// tests/unit/pages/BuildProject/FolderSelector.test.tsx
describe('FolderSelector Animations', () => {
  it('should animate button on hover', async () => {
    // Test hover effect
  })

  it('should show loading state animation', async () => {
    // Test spinner animation during folder selection
  })
})
```

**Animation Opportunities**:

- Button hover (inherited from Button component)
- Loading spinner during folder dialog

### Deliverables

- [ ] All tests passing
- [ ] Button component with hover/press animations
- [ ] Input component with focus/error/success animations
- [ ] FolderSelector with polished interactions
- [ ] Visual QA completed
- [ ] Accessibility verified

### Success Criteria

- ✅ Buttons feel responsive and tactile
- ✅ Inputs provide clear focus feedback
- ✅ All animations < 200ms (micro-interactions)
- ✅ 60fps maintained
- ✅ prefers-reduced-motion respected

---

## Phase 2: BuildProject State Transitions

**Goal**: Smooth transitions between BuildProject workflow states (idle → creating → success).

### Components in Scope

1. `src/pages/BuildProject/ProjectConfigurationStep.tsx`
2. `src/pages/BuildProject/AddFootageStep.tsx`
3. `src/pages/BuildProject/CreateProjectStep.tsx`
4. `src/pages/BuildProject/SuccessSection.tsx`
5. `src/pages/BuildProject/ProgressBar.tsx`

### Tasks

#### 2.1: Step Card Collapse Animation

**Files**: All step components

**Tests to Write**:

```typescript
// tests/unit/pages/BuildProject/ProjectConfigurationStep.test.tsx
describe('ProjectConfigurationStep Animations', () => {
  it('should animate collapse when showSuccess is true', async () => {
    // Test height change from expanded to collapsed
  })

  it('should animate expand when showSuccess is false', async () => {
    // Test height change from collapsed to expanded
  })

  it('should use STEP_CARD_ANIMATION constants', () => {
    // Verify constants are used
  })

  it('should respect prefers-reduced-motion', () => {
    // Test instant collapse/expand when reduced motion
  })
})
```

**Current Implementation**: Uses inline styles (CSS transitions)

**Enhancement Opportunities**:

- Add spring physics for more natural collapse/expand
- Stagger collapse of multiple steps
- Add opacity fade for content inside cards

**Implementation Approach**:

- Convert to Framer Motion `AnimatePresence` for content
- Use `motion.div` with `animate` prop for height
- Apply `STEP_CARD_ANIMATION` constants

#### 2.2: Progress Bar Animation

**File**: `src/pages/BuildProject/ProgressBar.tsx`

**Tests to Write**:

```typescript
// tests/unit/pages/BuildProject/ProgressBar.test.tsx
describe('ProgressBar Animations', () => {
  it('should animate progress bar width smoothly', async () => {
    // Test width animation from 0% to 100%
  })

  it('should animate completion state', async () => {
    // Test checkmark appearance
  })

  it('should use PROGRESS_ANIMATIONS constants', () => {
    // Verify constants
  })

  it('should respect prefers-reduced-motion', () => {
    // Test instant progress updates
  })
})
```

**Animation Opportunities**:

- Smooth progress bar fill (ease-out curve)
- Pulse effect during active copying
- Success checkmark with bounce

#### 2.3: Success Section Entrance

**File**: `src/pages/BuildProject/SuccessSection.tsx`

**Tests to Write**:

```typescript
// tests/unit/pages/BuildProject/SuccessSection.test.tsx
describe('SuccessSection Animations', () => {
  it('should fade in when showSuccess is true', async () => {
    // Test opacity change
  })

  it('should slide up from below', async () => {
    // Test y transform
  })

  it('should animate action buttons staggered', async () => {
    // Test stagger effect on buttons
  })

  it('should use SUCCESS_ANIMATION constants', () => {
    // Verify constants
  })
})
```

**Animation Opportunities**:

- Fade + slide up entrance
- Staggered button appearance
- Success icon with spring animation

### Deliverables

- [ ] All tests passing
- [ ] Smooth step card collapse/expand
- [ ] Animated progress bar
- [ ] Polished success section entrance
- [ ] Visual QA completed
- [ ] Accessibility verified

### Success Criteria

- ✅ State transitions feel smooth and intentional
- ✅ Progress bar updates don't feel jarring
- ✅ Success section feels celebratory but not over-the-top
- ✅ All animations 300-600ms
- ✅ 60fps maintained

---

## Phase 3: BuildProject List Animations

**Goal**: Staggered entrance animations for file lists.

### Components in Scope

1. `src/pages/BuildProject/ProjectFileList.tsx`

### Tasks

#### 3.1: File List Stagger Animation

**File**: `src/pages/BuildProject/ProjectFileList.tsx`

**Tests to Write**:

```typescript
// tests/unit/pages/BuildProject/ProjectFileList.test.tsx
describe('ProjectFileList Animations', () => {
  it('should render list items with stagger animation', async () => {
    // Test stagger delay between items
  })

  it('should animate new file addition', async () => {
    // Test new item entrance animation
  })

  it('should animate file deletion with exit animation', async () => {
    // Test exit animation
  })

  it('should animate camera selector on hover', async () => {
    // Test hover effect on dropdown
  })

  it('should animate delete button on hover', async () => {
    // Test hover effect with color change
  })

  it('should use FILE_LIST_ANIMATION constants', () => {
    // Verify constants
  })

  it('should respect prefers-reduced-motion', () => {
    // Test instant rendering
  })
})
```

**Animation Opportunities**:

- Initial list render: staggered fade-up
- New file added: individual fade-up
- File deleted: fade-out + slide-out
- Delete button hover: scale + color change
- Camera selector hover: border highlight

**Implementation Approach**:

- Use Framer Motion `variants` for container + items
- Use `AnimatePresence` for exit animations
- Apply `FILE_LIST_ANIMATION` constants
- Add `layoutId` for smooth reordering (if drag-drop added later)

### Deliverables

- [ ] All tests passing
- [ ] Staggered list item entrance
- [ ] Smooth file addition/deletion
- [ ] Polished hover states
- [ ] Visual QA completed
- [ ] Accessibility verified

### Success Criteria

- ✅ List feels dynamic and alive
- ✅ Stagger timing feels natural (50ms between items)
- ✅ Exit animations don't feel abrupt
- ✅ Hover effects are subtle but noticeable
- ✅ 60fps maintained

---

## Phase 4: Global Component Library

**Goal**: Apply animations to shared UI components (cards, dialogs, tooltips).

### Components in Scope

1. `src/components/ui/card.tsx`
2. `src/components/ui/dialog.tsx`
3. `src/components/ui/alert-dialog.tsx`
4. `src/components/ui/tooltip.tsx`
5. `src/components/ui/tabs.tsx`
6. `src/components/ui/accordion.tsx`

### Tasks

#### 4.1: Card Component

**File**: `src/components/ui/card.tsx`

**Tests to Write**:

```typescript
// tests/unit/components/ui/card.test.tsx
describe('Card Animations', () => {
  it('should apply hover elevation animation', async () => {
    // Test shadow lift on hover
  })

  it('should apply entrance animation on mount', async () => {
    // Test fade + slide up
  })

  it('should use CARD_ANIMATIONS constants', () => {
    // Verify constants
  })
})
```

**Animation Opportunities**:

- Hover: subtle scale + shadow elevation
- Entrance: fade + slide up
- Exit: fade + scale down (when removed)

#### 4.2: Dialog/Modal Components

**Files**: `dialog.tsx`, `alert-dialog.tsx`

**Tests to Write**:

```typescript
// tests/unit/components/ui/dialog.test.tsx
describe('Dialog Animations', () => {
  it('should animate backdrop fade-in', async () => {
    // Test backdrop opacity
  })

  it('should animate content scale + slide', async () => {
    // Test content entrance
  })

  it('should animate exit', async () => {
    // Test reverse animation
  })

  it('should use MODAL_ANIMATIONS constants', () => {
    // Verify constants
  })
})
```

**Animation Opportunities**:

- Backdrop: fade-in/out
- Content: scale + slide with spring physics
- Exit: reverse entrance animation

#### 4.3: Tooltip Component

**File**: `src/components/ui/tooltip.tsx`

**Animation Opportunities**:

- Fade + scale entrance (quick, 150ms)
- Directional slide based on position

#### 4.4: Tabs & Accordion

**Files**: `tabs.tsx`, `accordion.tsx`

**Animation Opportunities**:

- Tab switch: slide/fade content
- Accordion: smooth height animation
- Active indicator: smooth position change

### Deliverables

- [ ] All tests passing
- [ ] Animated card components
- [ ] Polished dialog/modal animations
- [ ] Quick, responsive tooltip animations
- [ ] Smooth tab/accordion transitions
- [ ] Visual QA completed
- [ ] Accessibility verified

### Success Criteria

- ✅ Components feel cohesive across the app
- ✅ Modal entrances feel polished (spring physics)
- ✅ Tooltips appear instantly (150ms max)
- ✅ All animations reuse constants
- ✅ 60fps maintained

---

## Phase 5: Modal & Dialog Animations

**Goal**: Polish animations for modals throughout the app (Trello integration, Sprout Video, etc.).

### Components in Scope

1. `src/pages/BuildProject/SuccessSection.tsx` - Trello modal
2. `src/pages/UploadTrello/*` components
3. `src/pages/UploadSprout/*` components
4. Any other modal dialogs

### Tasks

#### 5.1: Trello Card Update Dialog

**Animation Opportunities**:

- Dialog entrance with spring
- Loading spinner during API call
- Success/error toast animations
- Form input focus states

#### 5.2: Video Upload Modals

**Animation Opportunities**:

- Upload progress animation
- File preview entrance
- Success confirmation

### Deliverables

- [ ] All tests passing
- [ ] Polished modal experiences
- [ ] Consistent with Phase 4 patterns
- [ ] Visual QA completed
- [ ] Accessibility verified

---

## Phase 6: Advanced Interactions

**Goal**: Add advanced animations (scroll-based, drag-and-drop feedback).

### Components in Scope

1. Scroll-triggered animations
2. Drag-and-drop feedback (if applicable)
3. Skeleton loaders

### Tasks

#### 6.1: Scroll-Based Animations

**Components**: Any long-scrolling pages

**Animation Opportunities**:

- Fade in on scroll for sections
- Parallax effects (use sparingly)
- Sticky header animations

#### 6.2: Skeleton Loaders

**Files**: Any loading states

**Animation Opportunities**:

- Pulse effect for placeholders
- Smooth transition from skeleton → real content

### Deliverables

- [ ] All tests passing
- [ ] Scroll animations feel natural
- [ ] Loading states are polished
- [ ] Visual QA completed
- [ ] Accessibility verified

---

## Phase 7: Polish & Performance Optimization

**Goal**: Final polish, performance audit, and comprehensive testing.

### Tasks

#### 7.1: Performance Audit

- [ ] Profile all animations with Chrome DevTools
- [ ] Verify 60fps on lower-end devices
- [ ] Check bundle size impact of Framer Motion
- [ ] Optimize heavy animations

#### 7.2: Accessibility Audit

- [ ] Test all animations with `prefers-reduced-motion`
- [ ] Verify focus management during animations
- [ ] Check WCAG 2.1 Level AAA compliance
- [ ] Test with screen readers

#### 7.3: Cross-Platform Testing

- [ ] Test on macOS (WebKit)
- [ ] Test on Windows (Chromium)
- [ ] Test on Linux (Chromium)
- [ ] Verify Tauri-specific behavior

#### 7.4: Documentation

- [ ] Document all animation patterns
- [ ] Create video demos of key animations
- [ ] Update CLAUDE.md with animation guidelines
- [ ] Create animation style guide

### Deliverables

- [ ] Performance report
- [ ] Accessibility compliance report
- [ ] Cross-platform test results
- [ ] Comprehensive documentation

### Success Criteria

- ✅ All animations 60fps on target devices
- ✅ Bundle size increase < 100kb
- ✅ 100% WCAG 2.1 Level AAA compliance
- ✅ All platforms tested and verified

---

## Testing Strategy

### Test Types

#### 1. Unit Tests (Per Component)

- Animation presence (element has animation)
- Animation constants (correct values used)
- Animation lifecycle (enter → animate → exit)
- Accessibility (prefers-reduced-motion)

**Location**: `tests/unit/components/**/*.test.tsx`

#### 2. Integration Tests

- User interactions trigger animations
- State changes animate correctly
- Multiple animations coordinate properly

**Location**: `tests/integration/**/*.test.tsx`

#### 3. Visual Regression Tests (Optional)

- Screenshots before/after animations
- Ensure visual consistency

**Tool**: Playwright (already installed)

### Test Coverage Target

- **90%** for animation utilities
- **80%** for animated components
- **100%** for accessibility features

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test ProjectFileList.test.tsx

# Run with coverage
npm run test:coverage

# Run in watch mode (during development)
npm run test -- --watch
```

---

## Success Metrics

### Quantitative Metrics

- [ ] **Performance**: All animations maintain 60fps
- [ ] **Bundle Size**: Framer Motion adds < 100kb to bundle
- [ ] **Test Coverage**: > 80% for animated components
- [ ] **Accessibility**: 100% compliance with prefers-reduced-motion

### Qualitative Metrics

- [ ] **Feel**: Interactions feel smooth and natural
- [ ] **Consistency**: All animations use shared constants
- [ ] **Purpose**: Every animation serves a clear purpose
- [ ] **Polish**: App feels professional and refined

### User Feedback

- [ ] Internal testing with team members
- [ ] User feedback on "feel" and responsiveness
- [ ] Accessibility testing with users who prefer reduced motion

---

## Reference Implementation

### Example: Completing Phase 1, Task 1.2 (Button Animations)

This serves as a template for all future tasks.

#### Step 1: Invoke the Skill

```
User: Use the ux-animation-guru skill on src/components/ui/button.tsx
```

#### Step 2: Skill Analysis Output

```
Animation Opportunities Found:
1. Hover state - subtle scale + shadow (LOW complexity)
2. Press state - scale down for feedback (LOW complexity)
3. Disabled state - opacity fade (LOW complexity)

Required Constants: BUTTON_ANIMATIONS (already exists)
Tests Required: 4
Estimated Implementation: 15 minutes
```

#### Step 3: Red Phase (Tests Written)

```typescript
// tests/unit/components/ui/button.test.tsx
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'
import { BUTTON_ANIMATIONS } from '@/constants/animations'
import { mockReducedMotion, expectMotionComponent } from '@/tests/utils/animation-testing'

describe('Button Animations', () => {
  it('should be a Framer Motion component', () => {
    const { getByRole } = render(<Button>Click me</Button>)
    const button = getByRole('button')
    expectMotionComponent(button)
  })

  it('should apply hover animation on mouse enter', async () => {
    const user = userEvent.setup()
    const { getByRole } = render(<Button>Hover me</Button>)
    const button = getByRole('button')

    await user.hover(button)

    // Check that transform is applied (scale)
    const styles = window.getComputedStyle(button)
    expect(styles.transform).not.toBe('none')
  })

  it('should use BUTTON_ANIMATIONS.hover constants', () => {
    expect(BUTTON_ANIMATIONS.hover.scale).toBe(1.02)
    expect(BUTTON_ANIMATIONS.hover.duration).toBe(150)
  })

  it('should respect prefers-reduced-motion', () => {
    mockReducedMotion(true)

    const { getByRole } = render(<Button>Click me</Button>)
    const button = getByRole('button')

    // Should not have animation
    const styles = window.getComputedStyle(button)
    const duration = parseFloat(styles.transitionDuration) * 1000
    expect(duration).toBe(0)
  })
})
```

**Run Tests**: `npm run test button.test.tsx` → ❌ FAIL (expected)

#### Step 4: Green Phase (Implementation)

```typescript
// src/components/ui/button.tsx
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { BUTTON_ANIMATIONS, DURATION, EASING } from '@/constants/animations'
// ... other imports

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion()
    const Comp = asChild ? Slot : motion.button

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        whileHover={!shouldReduceMotion ? {
          scale: BUTTON_ANIMATIONS.hover.scale
        } : undefined}
        whileTap={!shouldReduceMotion ? {
          scale: BUTTON_ANIMATIONS.press.scale
        } : undefined}
        transition={shouldReduceMotion ? {
          duration: 0
        } : {
          duration: BUTTON_ANIMATIONS.hover.duration / 1000,
          ease: EASING.easeOut
        }}
        {...props}
      />
    )
  }
)
```

**Run Tests**: `npm run test button.test.tsx` → ✅ PASS

#### Step 5: Visual QA

- Open app in browser
- Test hover states
- Test press feedback
- Enable `prefers-reduced-motion` in DevTools
- Verify no animation when enabled

#### Step 6: Documentation

Add note to implementation plan:

```
✅ Phase 1.2 Complete: Button Animations
- Hover/press animations working
- Tests passing (4/4)
- Accessibility verified
- Can be used as reference for other interactive elements
```

---

## Notes

- This is a **living document** - update as phases complete
- Each completed phase serves as a **reference for future work**
- Don't rush - quality over speed
- When in doubt, **invoke the ux-animation-guru skill**
- Keep animations **subtle and purposeful**

---

## Quick Reference

### Animation Constant Usage

```typescript
import { BUTTON_ANIMATIONS, DURATION, EASING } from '@/constants/animations'

// Use predefined values
duration: DURATION.fast // 150ms
easing: EASING.appleEase // cubic-bezier(0.25, 0.1, 0.25, 1)

// Use component-specific constants
scale: BUTTON_ANIMATIONS.hover.scale // 1.02
```

### Testing Patterns

```typescript
import { expectMotionComponent, mockReducedMotion } from '@/tests/utils/animation-testing'

// Check for Framer Motion
expectMotionComponent(element)

// Mock reduced motion preference
mockReducedMotion(true)
```

### Framer Motion Patterns

```typescript
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

// Basic animation
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>
  {content}
</motion.div>

// With reduced motion support
const shouldReduceMotion = useReducedMotion()

<motion.div
  animate={shouldReduceMotion ? {} : { x: 100 }}
  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5 }}
>
  {content}
</motion.div>
```

---

**Ready to begin?** Start with Phase 1, Task 1.2: Button Micro-interactions!
