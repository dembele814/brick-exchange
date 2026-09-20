import { cn } from "@/lib/utils";
import logo from "@/assets/klockogram-mark.png";

export function BrandLogo({
  compact: _compact = false,
  full: _full = false,
  className,
}: {
  compact?: boolean;
  full?: boolean;
  className?: string;
}) {
  return (
    <img
      src={logo}
      alt="Klockogram"
      width={1536}
      height={1536}
      className={cn("size-11 shrink-0 rounded-xl object-cover", className)}
    />
  );
}
