import type { RouteStep } from "../types";
import { findLandmarkByName } from "../data/landmarks";
import { LandmarkVisual } from "./LandmarkVisual";
import "./StoryStepCard.css";

interface StoryStepCardProps {
  step: RouteStep;
  index: number; // 0-based
  total: number;
}

/**
 * A small frame, not a full-screen photo card — the same compact
 * thumb+badge+text layout the live-navigation instruction card uses, so
 * previewing a tour and actually walking it look like the same app.
 */
export function StoryStepCard({ step, index, total }: StoryStepCardProps) {
  const type = findLandmarkByName(step.landmark)?.type ?? "landmark";

  return (
    <div className="story-card">
      <div className="story-card__progress">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`story-card__dot ${i <= index ? "story-card__dot--active" : ""}`}
          />
        ))}
      </div>

      <div className="story-card__row">
        <div className="story-card__visual">
          <LandmarkVisual name={step.landmark} type={type} variant="thumb" />
        </div>
        <div className="story-card__heading">
          <p className="story-card__badge">
            STEP {index + 1} OF {total}
          </p>
          <p className="story-card__landmark">{step.landmark}</p>
        </div>
      </div>

      <p className="story-card__text">{step.text}</p>
    </div>
  );
}
