import { cn } from "@/lib/utils";
import logo from "@/assets/klockogram-logo.jpg";

export function BrandLogo({
  compact = false,
  full = false,
  className,
}: {
  compact?: boolean;
  full?: boolean;
  className?: string;
}) {
  if (full)
    return (
      <img
        src={logo}
        alt="Klockogram — więcej niż klocki"
        width={1254}
        height={1254}
        className={cn("h-auto w-44 rounded-2xl object-contain", className)}
      />
    );

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src={logo}
        alt=""
        width={1254}
        height={1254}
        className="size-10 shrink-0 rounded-xl object-cover"
      />
      {!compact && (
        <span className="font-display text-xl font-bold tracking-[-0.055em] text-foreground">
          klocko<span className="brand-gradient-text">gram</span>
        </span>
      )}
    </span>
  );
}
