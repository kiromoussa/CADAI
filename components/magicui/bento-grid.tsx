import { type ComponentPropsWithoutRef, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BentoGridProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
  className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<'div'> {
  name: string
  className: string
  background: ReactNode
  icon: ReactNode
  description: string
  href?: string
  onCtaClick?: () => void
  cta: string
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        'grid w-full auto-rows-[22rem] grid-cols-1 gap-4 md:grid-cols-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const BentoCard = ({
  name,
  className,
  background,
  icon,
  description,
  href,
  onCtaClick,
  cta,
  ...props
}: BentoCardProps) => {
  const ctaClassName =
    'pointer-events-auto inline-flex items-center gap-2 text-sm font-medium text-cyan hover:underline'

  const ctaControl =
    onCtaClick != null ? (
      <button type="button" onClick={onCtaClick} className={ctaClassName}>
        {cta}
        <span aria-hidden>→</span>
      </button>
    ) : (
      <Link href={href ?? '#'} className={ctaClassName}>
        {cta}
        <span aria-hidden>→</span>
      </Link>
    )

  return (
  <div
    className={cn(
      'group relative flex flex-col justify-between overflow-hidden rounded-xl',
      'border border-blueprint bg-navy',
      className
    )}
    {...props}
  >
    <div>{background}</div>
    <div className="p-4">
      <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 transition-all duration-300 lg:group-hover:-translate-y-10">
        <div className="origin-left transform-gpu text-cyan transition-all duration-300 ease-in-out group-hover:scale-75">
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-offwhite">{name}</h3>
        <p className="max-w-lg text-text-secondary">{description}</p>
      </div>

      <div className="pointer-events-none flex w-full translate-y-0 transform-gpu flex-row items-center transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:hidden">
        {ctaControl}
      </div>
    </div>

    <div className="pointer-events-none absolute bottom-0 hidden w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 lg:flex">
      {ctaControl}
    </div>

    <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-cyan/5" />
  </div>
  )
}

export { BentoCard, BentoGrid }
