import { cn } from '@components/lib/utils'
import { BUTTON_ANIMATIONS } from '@constants/animations'
import { useReducedMotion } from '@hooks/useReducedMotion'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion } from 'framer-motion'
import * as React from 'react'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

interface ButtonProps
  extends React.ComponentProps<'button'>,
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

export { Button, buttonVariants }
