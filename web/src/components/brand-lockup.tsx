import { cn } from '@/lib/utils'

type BrandLockupProps = {
  size?: 28 | 40 | 48
  subtitle?: string
}

export function BrandLockup({ size = 40, subtitle }: BrandLockupProps) {
  return (
    <div className={cn('flex items-center', size === 28 ? 'gap-2' : 'gap-3')}>
      <img
        src="/favicon.svg"
        alt=""
        width={size}
        height={size}
        className="shrink-0"
      />
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            'font-semibold tracking-[-0.045em]',
            size === 28 ? 'text-base/none' : 'text-xl/none',
          )}
        >
          teamorbit
        </span>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
    </div>
  )
}
