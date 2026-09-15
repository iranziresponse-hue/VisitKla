import type { RouteStep } from "../types";
import { findLandmarkByName } from "../data/landmarks";
import { LandmarkVisual } from "./LandmarkVisual";
import "./NavigationInstructionCard.css";

interface NavigationInstructionCardProps {
  step: RouteStep;
  index: number;
  total: number;
  /** Overrides step.text — must stay whatever's actually being spoken (see voice.ts's getSpokenText). */
  text?: string;
}

/**
 * Compact, fixed-height instruction row for the Active Navigation screen —
 * deliberately not the same component as the swipeable StoryStepCard used
 * on Route Preview. Turn-by-turn UIs (Google Maps, Waze) keep the current
 * instruction small and predictable so the action bar below it never gets
 * pushed off screen; a big vertical photo card doesn't fit that job.
 */
export function NavigationInstructionCard({
  step,
  index,
  total,
  text,
}: NavigationInstructionCardProps) {
  const type = findLandmarkByName(step.landmark)?.type ?? "landmark";

  return (
    <div className="nav-instruction">
      <div className="nav-instruction__progress">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`nav-instruction__dot ${i <= index ? "nav-instruction__dot--active" : ""}`}
          />
        ))}
      </div>
      <div className="nav-instruction__row">
        <div className="nav-instruction__visual">
          <LandmarkVisual name={step.landmark} type={type} variant="thumb" />
        </div>
        <div className="nav-instruction__text-block">
          <p className="nav-instruction__badge">
            STEP {index + 1} OF {total} · {step.landmark.toUpperCase()}
          </p>
          <p className="nav-instruction__text">{text ?? step.text}</p>
        </div>
      </div>
    </div>
  );
}
