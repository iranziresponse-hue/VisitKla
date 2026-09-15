import type { Landmark } from "../types";
import { LandmarkVisual } from "./LandmarkVisual";
import "./LandmarkListItem.css";

interface LandmarkListItemProps {
  landmark: Landmark;
  onClick: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  gate: "Gate",
  hospital: "Hospital",
  junction: "Junction",
  stage: "Boda / Taxi Stage",
  fuel_station: "Fuel Station",
  landmark: "Landmark",
  market: "Market",
  roundabout: "Roundabout",
};

export function LandmarkListItem({ landmark, onClick }: LandmarkListItemProps) {
  return (
    <button className="landmark-item" onClick={onClick}>
      <span className="landmark-item__thumb">
        <LandmarkVisual name={landmark.name} type={landmark.type} variant="thumb" />
      </span>
      <span className="landmark-item__info">
        <span className="landmark-item__name">{landmark.name}</span>
        <span className="landmark-item__type">
          {TYPE_LABELS[landmark.type] ?? landmark.type}
        </span>
      </span>
      <span className="landmark-item__chevron">›</span>
    </button>
  );
}
