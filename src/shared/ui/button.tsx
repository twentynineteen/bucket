import { Slot } from '@radix-ui/react-slot'
import { BUTTON_ANIMATIONS } from '@shared/constants'
import { useReducedMotion } from '@shared/hooks'
import { type VariantProps } from 'class-variance-authority'
import { motion } from 'framer-motion'
import * as React from 'react'
import { cn } from '../utils/cn'
import { buttonVariants } from './button-variants'

/**
 * framer-motion redefines the drag and animation handlers with its own event
 * shapes, so a plain React.ComponentProps<'button'> cannot be spread onto
 * motion.button. They are omitted rather than cast: the motion element owns
 * them, and a caller's React-shaped handler would never have been called with
 * a React event.
 */
type ConflictingMotionHandlers =
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragExit'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'

interface ButtonProps
  extends
    Omit<React.ComponentProps<'button'>, ConflictingMotionHandlers>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  animationStyle?: 'scale' | 'lift' | 'glow' | 'none'
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  animationStyle = 'scale',
  ...props
}: ButtonProps) {
  const shouldReduceMotion = useReducedMotion()

  // If asChild, we can't wrap with motion
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }

  const MotionButton = motion.button

  // Determine hover animation based on animationStyle
  const getHoverAnimation = () => {
    if (shouldReduceMotion || props.disabled || animationStyle === 'none') {
      return undefined
    }

    if (animationStyle === 'lift') {
      return { y: BUTTON_ANIMATIONS.lift.y }
    }

    if (animationStyle === 'glow') {
      return {
        filter: `brightness(${BUTTON_ANIMATIONS.glow.brightnessTo}) saturate(${BUTTON_ANIMATIONS.glow.saturateTo})`
      }
    }

    return { scale: BUTTON_ANIMATIONS.hover.scale }
  }

  // Get initial animation state
  const getInitialAnimation = () => {
    if (animationStyle === 'glow') {
      return {
        filter: `brightness(${BUTTON_ANIMATIONS.glow.brightnessFrom}) saturate(${BUTTON_ANIMATIONS.glow.saturateFrom})`
      }
    }
    return {}
  }

  return (
    <MotionButton
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size }),
        // For glow animation, remove transition-all to prevent conflict with Framer Motion
        animationStyle === 'glow' && '[transition:none]',
        className
      )}
      style={{
        // Prevent layout shift during scale animation
        transformOrigin: 'center',
        ...props.style
      }}
      initial={getInitialAnimation()}
      animate={getInitialAnimation()}
      whileHover={getHoverAnimation()}
      whileTap={
        !shouldReduceMotion && !props.disabled
          ? {
              scale: BUTTON_ANIMATIONS.press.scale
            }
          : undefined
      }
      transition={
        shouldReduceMotion
          ? {
              duration: 0
            }
          : {
              duration:
                animationStyle === 'glow'
                  ? BUTTON_ANIMATIONS.glow.duration / 1000
                  : BUTTON_ANIMATIONS.hover.duration / 1000,
              ease: [0.0, 0.0, 0.2, 1] // easeOut cubic-bezier
            }
      }
      {...props}
    />
  )
}

export { Button }
