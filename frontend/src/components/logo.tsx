import { APP_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"

/**
 * App mark: three rising bars on a brand-violet tile.
 * `inverted` swaps to a white tile with violet bars, for use on violet backgrounds.
 */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const tile = inverted ? "#fff" : "#8e51ff"
  const bar = inverted ? "#8e51ff" : "#fff"
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill={tile} />
      <rect x="9.5" y="21" width="5.5" height="10" rx="1.5" fill={bar} fillOpacity="0.55" />
      <rect x="17.25" y="15.5" width="5.5" height="15.5" rx="1.5" fill={bar} fillOpacity="0.78" />
      <rect x="25" y="9" width="5.5" height="22" rx="1.5" fill={bar} />
    </svg>
  )
}

export function Logo({
  className,
  markClassName,
  inverted,
}: {
  className?: string
  markClassName?: string
  inverted?: boolean
}) {
  return (
    <span className={cn("flex items-center gap-2.5 font-bold tracking-tight", className)}>
      <LogoMark className={markClassName} inverted={inverted} />
      <span>{APP_NAME}</span>
    </span>
  )
}
