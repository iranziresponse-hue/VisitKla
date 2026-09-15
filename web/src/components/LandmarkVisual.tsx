import type { LandmarkType } from "../types";
import { getLandmarkVisual } from "../lib/placeholderVisual";
import "./LandmarkVisual.css";

interface LandmarkVisualProps {
  name: string;
  type: LandmarkType;
  variant?: "thumb" | "banner";
  className?: string;
}

export function LandmarkVisual({
  name,
  type,
  variant = "thumb",
  className = "",
}: LandmarkVisualProps) {
  const { from, to, icon } = getLandmarkVisual(name, type);

  return (
    <div
      className={`landmark-visual landmark-visual--${variant} ${className}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      role="img"
      aria-label={name}
    >
      <svg
        className="landmark-visual__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
      {variant === "banner" && (
        <span className="landmark-visual__label">{name}</span>
      )}
    </div>
  );
}
