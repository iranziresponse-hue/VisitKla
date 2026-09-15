import type { RouteStep } from "../types";
import { findLandmarkByName } from "../data/landmarks";
import { LandmarkVisual } from "./LandmarkVisual";
import { formatDistance } from "../lib/distance";
import "./ApproachCard.css";

interface ApproachCardProps {
  target: RouteStep;
  distanceMeters: number;
}

/**
 * Shown before real turn-by-turn starts, when the user's GPS says they're
 * meaningfully far from this fixed route's first landmark. VisitKla only
 * covers 20 hardcoded Zone 1 routes — it can't draw a path from wherever
 * someone is actually standing, so this card says so plainly instead of
 * silently narrating "Start at X" as if that were true.
 */
export function ApproachCard({ target, distanceMeters }: ApproachCardProps) {
  const type = findLandmarkByName(target.landmark)?.type ?? "landmark";

  return (
    <div className="approach-card">
      <div className="approach-card__row">
        <div className="approach-card__visual">
          <LandmarkVisual name={target.landmark} type={type} variant="thumb" />
        </div>
        <div className="approach-card__text-block">
          <p className="approach-card__badge">HEAD TO YOUR ROUTE START</p>
          <p className="approach-card__text">
            {target.landmark} · {formatDistance(distanceMeters)} away
          </p>
        </div>
      </div>
      <p className="approach-card__hint">
        This fixed route begins at {target.landmark}, not exactly where
        you're standing. Walk there, or continue anyway.
      </p>
    </div>
  );
}
