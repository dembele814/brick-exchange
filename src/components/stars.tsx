import { Star } from "lucide-react";

export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Ocena ${rating} na 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= rounded ? "fill-sun text-sun" : "text-border"}
          aria-hidden
        />
      ))}
    </span>
  );
}
