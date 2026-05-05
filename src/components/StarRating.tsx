import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value, size = 16, onChange, className,
}: { value: number; size?: number; onChange?: (v: number) => void; className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        return (
          <Star
            key={n}
            onClick={onChange ? () => onChange(n) : undefined}
            className={cn(
              "transition-colors",
              filled ? "fill-[var(--accent)] text-[var(--accent)]" : "text-muted-foreground/40",
              onChange && "cursor-pointer hover:scale-110",
            )}
            style={{ width: size, height: size }}
          />
        );
      })}
    </div>
  );
}
