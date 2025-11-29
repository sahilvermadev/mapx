import { cn } from "@/lib/utils"
import { useTheme } from "@/contexts/ThemeContext"
import { THEMES } from "@/services/profileService"

function Skeleton({ className, style, ...props }: React.ComponentProps<"div">) {
  const { theme: themeName } = useTheme();
  const selectedTheme = themeName && THEMES[themeName as keyof typeof THEMES] 
    ? THEMES[themeName as keyof typeof THEMES] 
    : null;
  
  const skeletonStyle: React.CSSProperties = {
    ...style,
    backgroundColor: selectedTheme 
      ? selectedTheme.borderColorMuted || selectedTheme.hoverBackground || 'rgba(0, 0, 0, 0.1)'
      : undefined,
  };

  return (
    <div
      className={cn("animate-pulse rounded-md", selectedTheme ? "" : "bg-muted", className)}
      tabIndex={-1}
      style={{ outline: 'none', ...skeletonStyle }}
      {...props}
    />
  )
}

export { Skeleton }
