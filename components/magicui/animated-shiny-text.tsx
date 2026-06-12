import { type ComponentPropsWithoutRef, type CSSProperties, type FC } from 'react'
import { cn } from '@/lib/utils'

export interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<'span'> {
  shimmerWidth?: number
}

export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
  children,
  className,
  shimmerWidth = 100,
  ...props
}) => {
  return (
    <span
      style={
        {
          '--shiny-width': `${shimmerWidth}px`,
        } as CSSProperties
      }
      className={cn(
        'mx-auto max-w-md bg-[length:var(--shiny-width)_100%] bg-clip-text bg-no-repeat text-offwhite/70',
        'animate-shiny-text bg-gradient-to-r from-transparent via-offwhite/80 via-50% to-transparent',
        '[background-position:0_0] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]',
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
