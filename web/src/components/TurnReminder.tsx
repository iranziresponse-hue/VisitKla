import type { RouteStep } from "../types";
import { formatDistance } from "../lib/distance";
import "./TurnReminder.css";

interface TurnReminderProps {
  step: RouteStep;
  distanceMeters: number | null;
  /** Inside the "get ready now" radius. */
  imminent: boolean;
}

export function TurnReminder({
  step,
  distanceMeters,
  imminent,
}: TurnReminderProps) {
  return (
    <div className={`turn ${imminent ? "turn--imminent" : ""}`}>
      <div className="turn__distance">
        {distanceMeters === null ? "NEXT" : formatDistance(distanceMeters)}
      </div>
      <div className="turn__body">
        <span className="turn__label">
          {imminent ? "Right here" : "Next landmark"}
        </span>
        <span className="turn__landmark">{step.landmark}</span>
      </div>
    </div>
  );
}
