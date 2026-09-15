import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RouteMap } from "../components/RouteMap";
import { StoryStepCard } from "../components/StoryStepCard";
import { BackButton } from "../components/BackButton";
import { useUserLocation } from "../hooks/useUserLocation";
import { useResolvedRoute } from "../hooks/useResolvedRoute";
import { haversineMeters, formatDistance } from "../lib/distance";
import "./RoutePreviewPage.css";

const NEARBY_THRESHOLD_METERS = 150;

export function RoutePreviewPage() {
  const { routeId = "" } = useParams();
  const navigate = useNavigate();
  const { route, precomputedPath } = useResolvedRoute(routeId);
  const [activeStory, setActiveStory] = useState(0);
  const storiesRef = useRef<HTMLDivElement | null>(null);
  const { location } = useUserLocation(false);

  useEffect(() => {
    setActiveStory(0);
  }, [routeId]);

  const distanceToStart = useMemo(() => {
    if (!location || !route) return null;
    return haversineMeters(
      location.latitude,
      location.longitude,
      route.steps[0].lat,
      route.steps[0].lng
    );
  }, [location, route]);

  if (!route) {
    return (
      <div className="route-preview-page route-preview-page--empty">
        <p>Route not found.</p>
        <button onClick={() => navigate("/")}>Back to search</button>
      </div>
    );
  }

  function scrollToStory(index: number) {
    const container = storiesRef.current;
    if (!container) return;
    const clamped = Math.max(0, Math.min(index, route!.steps.length - 1));
    const card = container.children[clamped] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveStory(clamped);
  }

  function handleStoriesScroll() {
    const container = storiesRef.current;
    if (!container) return;
    const { scrollLeft, clientWidth } = container;
    const center = scrollLeft + clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    Array.from(container.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(elCenter - center);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setActiveStory(closest);
  }

  return (
    <div className="route-preview-page">
      <div className="route-preview-page__map-pane">
        <RouteMap
          steps={route.steps}
          userLocation={location}
          approachTarget={route.steps[0]}
        />
        <BackButton onClick={() => navigate("/")} />
      </div>

      <div className="route-preview-page__content">
        <div className="route-preview-page__headline">
          <h2>
            {route.start} → {route.end}
          </h2>
          <p>{route.steps.length} landmarks</p>
          {distanceToStart !== null && (
            <p
              className={`route-preview-page__distance ${
                distanceToStart > NEARBY_THRESHOLD_METERS
                  ? "route-preview-page__distance--far"
                  : ""
              }`}
            >
              {distanceToStart > NEARBY_THRESHOLD_METERS
                ? `You're ${formatDistance(distanceToStart)} from ${route.start} — this fixed route starts there, not exactly where you're standing.`
                : `You're right at ${route.start} (${formatDistance(distanceToStart)}).`}
            </p>
          )}
        </div>

        <div className="route-preview-page__stories-wrap">
          {activeStory > 0 && (
            <button
              className="route-preview-page__arrow route-preview-page__arrow--prev"
              onClick={() => scrollToStory(activeStory - 1)}
              aria-label="Previous landmark"
            >
              ‹
            </button>
          )}
          <div
            className="route-preview-page__stories"
            ref={storiesRef}
            onScroll={handleStoriesScroll}
          >
            {route.steps.map((step, index) => (
              <div
                className="route-preview-page__story-item"
                key={`${step.order}-${step.landmark}`}
              >
                <StoryStepCard step={step} index={index} total={route.steps.length} />
              </div>
            ))}
          </div>
          {activeStory < route.steps.length - 1 && (
            <button
              className="route-preview-page__arrow route-preview-page__arrow--next"
              onClick={() => scrollToStory(activeStory + 1)}
              aria-label="Next landmark"
            >
              ›
            </button>
          )}
        </div>

        <div className="route-preview-page__story-dots">
          {route.steps.map((_, i) => (
            <button
              key={i}
              className={`route-preview-page__story-dot ${i === activeStory ? "route-preview-page__story-dot--active" : ""}`}
              onClick={() => scrollToStory(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <div className="route-preview-page__bottom">
          <button
            className="route-preview-page__watch"
            onClick={() => navigate(`/route/${route.id}/ride/landmark`, { state: { route, precomputedPath } })}
          >
            <span className="route-preview-page__watch-icon">▶</span>
            <span className="route-preview-page__watch-copy">
              <strong>Preview this tour</strong>
              <small>Fly through it landmark by landmark first</small>
            </span>
          </button>

          <button
            className="route-preview-page__btn route-preview-page__btn--landmark"
            onClick={() => navigate(`/route/${route.id}/navigate/landmark`, { state: { route, precomputedPath } })}
          >
            Start Tour
          </button>
        </div>
      </div>
    </div>
  );
}
