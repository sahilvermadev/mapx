import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      tabIndex={-1}
      style={{ outline: 'none' }}
      {...props}
    />
  )
}

export { Skeleton }
