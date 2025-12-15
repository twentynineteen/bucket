# Animation Testing Patterns

## Overview

This document provides testing patterns for animation verification using Vitest, Testing Library, and custom animation testing utilities.

## Test Structure

### AAA Pattern (Arrange-Act-Assert)

```typescript
describe('Component Animations', () => {
  it('should animate on state change', () => {
    // Arrange: Set up component and initial state
    const { getByRole, rerender } = render(<Component state="idle" />)
    const element = getByRole('button')

    // Act: Trigger the change that should animate
    rerender(<Component state="loading" />)

    // Assert: Verify animation was applied
    expectElementToHaveAnimation(element)
  })
})
```

## Test Categories

### 1. Animation Presence Tests

Verify that animations are applied to elements.

```typescript
import { expectElementToHaveAnimation, expectMotionComponent } from '@/tests/utils/animation-testing'

describe('Animation Presence', () => {
  it('should be a Framer Motion component', () => {
    const { getByRole } = render(<AnimatedButton>Click</AnimatedButton>)
    const button = getByRole('button')

    expectMotionComponent(button)
  })

  it('should have CSS transition', () => {
    const { getByRole } = render(<TransitionDiv>Content</TransitionDiv>)
    const div = getByRole('article')

    expectElementToHaveAnimation(div)
  })
})
```

### 2. Animation Constant Tests

Verify that constants are used correctly.

```typescript
import { BUTTON_ANIMATIONS, DURATION, EASING } from '@/constants/animations'

describe('Animation Constants', () => {
  it('should use defined hover duration', () => {
    expect(BUTTON_ANIMATIONS.hover.duration).toBe(DURATION.fast)
    expect(DURATION.fast).toBe(150)
  })

  it('should use Apple easing curve', () => {
    expect(BUTTON_ANIMATIONS.hover.easing).toBe(EASING.easeOut)
  })

  it('should maintain consistent scale values', () => {
    expect(BUTTON_ANIMATIONS.hover.scale).toBe(1.02)
    expect(BUTTON_ANIMATIONS.press.scale).toBe(0.98)
  })
})
```

### 3. Animation Lifecycle Tests

Test full animation cycles (enter → animate → exit).

```typescript
import { AnimatePresence } from 'framer-motion'
import { waitForAnimation } from '@/tests/utils/animation-testing'

describe('Animation Lifecycle', () => {
  it('should animate entrance', async () => {
    const { getByTestId } = render(<AnimatedCard />)
    const card = getByTestId('card')

    // Check initial state (before animation completes)
    const initialOpacity = window.getComputedStyle(card).opacity
    expect(parseFloat(initialOpacity)).toBeLessThan(1)

    // Wait for animation to complete
    await waitForAnimation(card, 300)

    // Check final state
    const finalOpacity = window.getComputedStyle(card).opacity
    expect(parseFloat(finalOpacity)).toBe(1)
  })

  it('should animate exit', async () => {
    const { getByTestId, rerender } = render(
      <AnimatePresence>
        <AnimatedCard key="card" />
      </AnimatePresence>
    )

    const card = getByTestId('card')

    // Trigger exit
    rerender(<AnimatePresence>{null}</AnimatePresence>)

    // Wait for exit animation
    await waitForAnimation(card, 300)

    // Should be removed from DOM
    expect(card).not.toBeInTheDocument()
  })
})
```

### 4. User Interaction Tests

Test animations triggered by user actions.

```typescript
import userEvent from '@testing-library/user-event'
import { expectHoverAnimation } from '@/tests/utils/animation-testing'

describe('User Interaction Animations', () => {
  it('should animate on hover', async () => {
    const user = userEvent.setup()
    const { getByRole } = render(<HoverableCard>Content</HoverableCard>)
    const card = getByRole('article')

    await expectHoverAnimation(card, user)
  })

  it('should animate on click', async () => {
    const user = userEvent.setup()
    const { getByRole } = render(<ClickableButton>Click</ClickableButton>)
    const button = getByRole('button')

    const beforeTransform = window.getComputedStyle(button).transform
    await user.click(button)

    await waitFor(() => {
      const afterTransform = window.getComputedStyle(button).transform
      expect(afterTransform).not.toBe(beforeTransform)
    })
  })

  it('should animate on focus', async () => {
    const user = userEvent.setup()
    const { getByRole } = render(<FocusableInput />)
    const input = getByRole('textbox')

    await user.tab() // Focus input

    await waitFor(() => {
      const styles = window.getComputedStyle(input)
      expect(styles.borderColor).not.toBe('initial')
    })
  })
})
```

### 5. Accessibility Tests

Verify animations respect accessibility preferences.

```typescript
import { mockReducedMotion, expectReducedMotionRespected } from '@/tests/utils/animation-testing'

describe('Animation Accessibility', () => {
  it('should respect prefers-reduced-motion', () => {
    mockReducedMotion(true)

    const { getByRole } = render(<AnimatedCard />)
    const card = getByRole('article')

    expectReducedMotionRespected(card)
  })

  it('should disable animations when reduced motion is preferred', () => {
    mockReducedMotion(true)

    const { getByRole } = render(<MotionButton>Click</MotionButton>)
    const button = getByRole('button')

    const styles = window.getComputedStyle(button)
    const duration = parseFloat(styles.transitionDuration) * 1000

    expect(duration).toBe(0)
  })

  it('should maintain focus visibility during animation', async () => {
    const user = userEvent.setup()
    const { getByRole } = render(<AnimatedButton>Click</AnimatedButton>)
    const button = getByRole('button')

    await user.tab() // Focus button

    expectFocusVisibleDuringAnimation(button)
  })
})
```

### 6. Stagger Animation Tests

Test sequential/staggered animations.

```typescript
import { expectStaggerAnimation } from '@/tests/utils/animation-testing'

describe('Stagger Animations', () => {
  it('should stagger list item animations', () => {
    const items = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' }
    ]

    const { getAllByRole } = render(<StaggeredList items={items} />)
    const listItems = getAllByRole('listitem')

    expectStaggerAnimation(listItems, 50) // 50ms stagger
  })

  it('should not exceed maximum stagger time', () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      name: `Item ${i}`
    }))

    const { getAllByRole } = render(<StaggeredList items={manyItems} />)
    const listItems = getAllByRole('listitem')

    // Even with 20 items, total stagger shouldn't exceed 500ms
    const lastItem = listItems[listItems.length - 1]
    const styles = window.getComputedStyle(lastItem)
    const delay = parseFloat(styles.animationDelay || styles.transitionDelay) * 1000

    expect(delay).toBeLessThanOrEqual(500)
  })
})
```

### 7. Performance Tests

Verify animations use GPU-accelerated properties.

```typescript
import { expectGPUAcceleratedAnimation } from '@/tests/utils/animation-testing'

describe('Animation Performance', () => {
  it('should only animate GPU-accelerated properties', () => {
    const { getByRole } = render(<OptimizedCard />)
    const card = getByRole('article')

    expectGPUAcceleratedAnimation(card)
  })

  it('should avoid layout-triggering properties', () => {
    const { getByRole } = render(<AnimatedDiv />)
    const div = getByRole('region')

    const styles = window.getComputedStyle(div)
    const transitionProps = styles.transitionProperty.split(',')

    // Should not animate width, height, margin, padding, etc.
    const layoutProps = ['width', 'height', 'margin', 'padding', 'top', 'left']
    const hasLayoutProp = transitionProps.some(prop =>
      layoutProps.includes(prop.trim())
    )

    expect(hasLayoutProp).toBe(false)
  })
})
```

### 8. State Transition Tests

Test animations between different component states.

```typescript
describe('State Transition Animations', () => {
  it('should animate from loading to success', async () => {
    const { getByTestId, rerender } = render(<StatusIndicator status="loading" />)
    const indicator = getByTestId('status')

    expect(indicator).toHaveClass('loading')

    rerender(<StatusIndicator status="success" />)

    await waitFor(() => {
      expect(indicator).toHaveClass('success')
    })
  })

  it('should animate from idle to error with shake', async () => {
    const { getByRole, rerender } = render(<Form status="idle" />)
    const form = getByRole('form')

    rerender(<Form status="error" />)

    // Should have shake animation
    await waitFor(() => {
      const styles = window.getComputedStyle(form)
      expect(styles.animation).toContain('shake')
    })
  })
})
```

## Mocking Utilities

### Mock Reduced Motion

```typescript
export const mockReducedMotion = (shouldReduce: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: shouldReduce && query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}
```

### Mock IntersectionObserver

```typescript
export const mockIntersectionObserver = () => {
  global.IntersectionObserver = vi.fn().mockImplementation(callback => ({
    observe: vi.fn(element => {
      // Simulate element coming into view
      callback([{ isIntersecting: true, target: element }])
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
}
```

## Best Practices

### 1. Test Behavior, Not Implementation

❌ **Avoid:**

```typescript
it('should call animate function', () => {
  const spy = vi.spyOn(component, 'animate')
  // Testing internal implementation
})
```

✅ **Prefer:**

```typescript
it('should scale button on hover', async () => {
  // Test observable behavior
  await user.hover(button)
  expect(button).toHaveStyle({ transform: 'scale(1.02)' })
})
```

### 2. Use Custom Matchers

Create reusable assertion helpers:

```typescript
expect.extend({
  toBeAnimated(element: HTMLElement) {
    const styles = window.getComputedStyle(element)
    const hasAnimation = styles.animation !== 'none' || styles.transition !== 'none'

    return {
      pass: hasAnimation,
      message: () => `Expected element to ${hasAnimation ? 'not ' : ''}be animated`
    }
  }
})
```

### 3. Wait for Animations

Always wait for animations to complete before asserting final state:

```typescript
// ❌ Don't
rerender(<Component state="success" />)
expect(element).toHaveClass('success') // May fail if animation hasn't started

// ✅ Do
rerender(<Component state="success" />)
await waitFor(() => {
  expect(element).toHaveClass('success')
})
```

### 4. Test Edge Cases

- Very fast interactions
- Interrupted animations
- Multiple rapid state changes
- Component unmounting during animation

## Common Pitfalls

### 1. Timing Issues

```typescript
// ❌ Hardcoded delays
await new Promise(resolve => setTimeout(resolve, 300))

// ✅ Use waitFor
await waitFor(() => expect(element).toHaveClass('animated'))
```

### 2. Not Cleaning Up

```typescript
afterEach(() => {
  // Reset mocks
  vi.restoreAllMocks()

  // Clear timers
  vi.clearAllTimers()
})
```

### 3. Flaky Tests

Avoid flakiness by:

- Using `waitFor` instead of fixed delays
- Mocking time with `vi.useFakeTimers()`
- Testing final state, not intermediate states

## Running Tests

```bash
# Run all animation tests
npm run test -- animation

# Run specific test file
npm run test button.test.tsx

# Watch mode for development
npm run test -- --watch button.test.tsx

# Coverage report
npm run test:coverage
```

## Example: Complete Test Suite

```typescript
// tests/unit/components/ui/button.test.tsx
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'
import { BUTTON_ANIMATIONS } from '@/constants/animations'
import {
  expectMotionComponent,
  mockReducedMotion,
  expectReducedMotionRespected
} from '@/tests/utils/animation-testing'

describe('Button Animations', () => {
  describe('Animation Presence', () => {
    it('should be a Framer Motion component', () => {
      const { getByRole } = render(<Button>Click me</Button>)
      const button = getByRole('button')
      expectMotionComponent(button)
    })
  })

  describe('Hover Interactions', () => {
    it('should scale up on hover', async () => {
      const user = userEvent.setup()
      const { getByRole } = render(<Button>Hover me</Button>)
      const button = getByRole('button')

      await user.hover(button)

      const transform = window.getComputedStyle(button).transform
      expect(transform).toContain('scale')
    })
  })

  describe('Animation Constants', () => {
    it('should use defined hover scale', () => {
      expect(BUTTON_ANIMATIONS.hover.scale).toBe(1.02)
    })

    it('should use fast duration', () => {
      expect(BUTTON_ANIMATIONS.hover.duration).toBe(150)
    })
  })

  describe('Accessibility', () => {
    it('should respect prefers-reduced-motion', () => {
      mockReducedMotion(true)

      const { getByRole } = render(<Button>Click me</Button>)
      const button = getByRole('button')

      expectReducedMotionRespected(button)
    })
  })
})
```
