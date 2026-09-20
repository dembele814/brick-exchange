import { cn } from "@/lib/utils";

export function BrandLogo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 42 42" className="size-full" fill="none">
          <path d="M8 11.5 21 4l13 7.5v15L21 34 8 26.5v-15Z" fill="url(#logo-a)" />
          <path
            d="m8 11.5 13 7.3 13-7.3M21 18.8V34"
            stroke="white"
            strokeOpacity=".78"
            strokeWidth="2"
          />
          <circle cx="21" cy="8.2" r="2.25" fill="white" fillOpacity=".95" />
          <circle cx="28.2" cy="12.2" r="2.25" fill="white" fillOpacity=".72" />
          <circle cx="13.8" cy="12.2" r="2.25" fill="white" fillOpacity=".72" />
          <defs>
            <linearGradient
              id="logo-a"
              x1="7"
              y1="6"
              x2="35"
              y2="34"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FF71C8" />
              <stop offset=".5" stopColor="#D946EF" />
              <stop offset="1" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-xl font-bold tracking-[-0.055em] text-foreground">
          klocko<span className="brand-gradient-text">gram</span>
        </span>
      )}
    </span>
  );
}
