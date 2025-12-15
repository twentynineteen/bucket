# Apple Animation Principles

## Overview

Apple's design philosophy emphasizes **clarity, deference, and depth** through motion. Every animation serves a purpose and enhances the user experience without being distracting.

## Core Principles

### 1. Purposeful Motion

- Every animation communicates meaning
- Motion guides attention to important changes
- Animations establish spatial relationships
- No animation for animation's sake

### 2. Natural Physics

- Animations feel realistic and grounded
- Use easing curves that mimic real-world motion
- Spring physics for interactive elements
- Avoid linear transitions (they feel robotic)

### 3. Subtle & Refined

- Prefer subtle over flashy
- Quick micro-interactions (100-200ms)
- Longer transitions feel smooth, not slow (300-500ms)
- User barely notices the animation, but feels the quality

### 4. Consistent Timing

- Establish rhythm through consistent durations
- Related animations share timing characteristics
- Predictability builds user confidence

## Easing Curves

### Apple's Preferred Curves

```
Standard Ease: cubic-bezier(0.25, 0.1, 0.25, 1)
- Smooth, natural acceleration/deceleration
- Default for most animations

Ease In: cubic-bezier(0.42, 0, 1, 1)
- Gradual start, quick finish
- Used for exits and dismissals

Ease Out: cubic-bezier(0, 0, 0.58, 1)
- Quick start, gradual finish
- Used for entrances and reveals

Ease In-Out: cubic-bezier(0.42, 0, 0.58, 1)
- Balanced curve
- Used for transitions between states
```

### Spring Physics

- Stiffness: 300-400 (responsive but not jarring)
- Damping: 20-30 (minimal bounce, feels controlled)
- Mass: 1 (standard weight)

## Common Patterns

### Modal/Dialog Entrance

```
Initial: { opacity: 0, scale: 0.95, y: 20 }
Animate: { opacity: 1, scale: 1, y: 0 }
Duration: 300ms
Easing: Spring (stiffness: 400, damping: 30)
```

### Button Press

```
Scale down: 0.95-0.98
Duration: 100ms
Easing: Ease Out
No delay
```

### List Item Stagger

```
Delay between items: 30-50ms
Duration per item: 300ms
Easing: Ease Out
Max stagger: 500ms total
```

### Focus States

```
Border/Shadow transition
Duration: 150ms
Easing: Ease Out
```

## Performance

### GPU-Accelerated Properties

✅ **Use these:**

- `transform` (translate, scale, rotate)
- `opacity`
- `filter` (sparingly)

❌ **Avoid these:**

- `width`, `height`
- `top`, `left`, `right`, `bottom`
- `margin`, `padding`

### Frame Rate

- Target: 60fps (16.67ms per frame)
- Acceptable: 30fps (33.33ms per frame) for complex animations
- Never: <30fps

## Accessibility

### Prefers Reduced Motion

Always respect `prefers-reduced-motion: reduce`:

- Disable decorative animations
- Reduce motion to instant transitions
- Keep essential animations but remove easing

### Focus Management

- Focus must remain visible during animations
- Tab order must not be disrupted
- Screen readers should announce state changes

## Examples from macOS/iOS

### Notification Banner

- Slides in from top
- Duration: 300ms
- Easing: Spring with slight bounce
- Auto-dismiss after 5s (fades out in 200ms)

### Sheet Presentation

- Slides up from bottom
- Duration: 350ms
- Backdrop fades in simultaneously
- Spring physics for natural feel

### Context Menu

- Fades in with slight scale (0.95 → 1.0)
- Duration: 200ms
- Easing: Ease Out
- No delay

### Button Hover

- Subtle brightness increase
- Duration: 150ms
- Easing: Linear
- No transform (for native buttons)

## Anti-Patterns

❌ **Avoid:**

- Animations longer than 600ms (unless user-controlled)
- Multiple simultaneous competing animations
- Bouncy springs for everything (use sparingly)
- Linear easing (feels mechanical)
- Over-the-top effects (zooms, spins, flips)
- Animation delays without purpose

## Testing Checklist

- [ ] Animation serves a clear purpose
- [ ] Duration feels natural (not too fast or slow)
- [ ] Easing curve appropriate for the motion type
- [ ] Maintains 60fps on target devices
- [ ] Respects prefers-reduced-motion
- [ ] Focus remains visible and manageable
- [ ] Works on all supported platforms

## Resources

- [Apple Human Interface Guidelines - Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [WebKit CSS Animations](https://webkit.org/blog/138/css-animation/)
- [Framer Motion Documentation](https://www.framer.com/motion/)
