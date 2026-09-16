import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchRoadAlternatives, type RoadRouteOption } from "../lib/roadRoute";
import { synthesizeRoute, type NamedPoint } from "../lib/customRoute";
import { haversineMeters, formatDistance } from "../lib/distance";
import { BackButton } from "../components/BackButton";
import { RouteAlternativesMap } from "../components/RouteAlternativesMap";
import "./RouteChoicePage.css";

interface PlanState {
  from?: NamedPoint;
  to?: NamedPoint;
}

/**
 * "There could be many" routes between two arbitrary points — Kampala
 * junctions genuinely do have more than one sane way through them. This
 * page is what lets a user actually choose, instead of the app silently
 * picking one for them, for any freely-searched trip (our 20 curated Zone
 * 1 routes skip this — that path was already hand-picked).
 */
export function RouteChoicePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { from, to } = (location.state as PlanState | null) ?? {};

  const [options, setOptions] = useState<RoadRouteOption[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    fetchRoadAlternatives(
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng }
    ).then((opts) => {
      if (!cancelled) setOptions(opts);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!from || !to) {
    return (
      <div className="plan-page plan-page--empty">
        <p>Pick a start and a destination first.</p>
        <button onClick={() => navigate("/")}>Back to map</button>
      </div>
    );
  }

  function choose(opt: RoadRouteOption | null) {
    const distance =
      opt?.distanceMeters ?? haversineMeters(from!.lat, from!.lng, to!.lat, to!.lng);
    const route = synthesizeRoute(from!, to!, distance, opt?.maneuvers);
    navigate(`/route/${route.id}`, {
      state: { route, precomputedPath: opt?.points },
    });
  }

  return (
    <div className="plan-page">
      <div className="plan-page__map">
        {options && options.length > 0 ? (
          <RouteAlternativesMap from={from} to={to} options={options} activeIndex={activeIndex} />
        ) : (
          <div className="plan-page__map-placeholder" />
        )}
      </div>
      <BackButton onClick={() => navigate("/")} />

      <div className="plan-page__sheet">
        <div className="plan-page__header">
          <span className="plan-page__kicker">Choose your route</span>
          <h1 className="plan-page__title">
            {from.name} <span>→</span> {to.name}
          </h1>
        </div>

        {options === null && (
          <div className="plan-page__loading">
            <span className="plan-page__spinner" />
            <p>Finding routes…</p>
          </div>
        )}

        {options !== null && options.length === 0 && (
          <div className="plan-page__fallback">
            <p>Couldn't reach the road router right now.</p>
            <button className="plan-page__fallback-btn" onClick={() => choose(null)}>
              Continue anyway
            </button>
          </div>
        )}

        {options && options.length > 0 && (
          <div className="plan-page__options">
            {options.map((opt, i) => {
              const minutes = Math.max(1, Math.round(opt.durationSeconds / 60));
              return (
                <button
                  key={i}
                  className={`plan-page__option ${i === activeIndex ? "plan-page__option--active" : ""}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onFocus={() => setActiveIndex(i)}
                  onClick={() => choose(opt)}
                >
                  <span className="plan-page__option-dot" />
                  <span className="plan-page__option-copy">
                    <span className="plan-page__option-label">
                      {i === 0 ? "Fastest" : `Alternative ${i}`}
                    </span>
                    <span className="plan-page__option-stats">
                      {formatDistance(opt.distanceMeters)} · ~{minutes} min ride
                    </span>
                  </span>
                  <span className="plan-page__option-arrow">›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
