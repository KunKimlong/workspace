import { LuLoaderCircle } from "react-icons/lu"

export function FullPageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center text-muted-foreground">
      <LuLoaderCircle className="size-6 animate-spin" aria-label="Loading" />
    </div>
  )
}
