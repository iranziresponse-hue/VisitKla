import { useEffect, useRef, useState } from "react";
import type { Landmark } from "../types";
import type { GeocodeResult } from "../lib/geocode";
import { searchPlaces, formatPlaceLabel } from "../lib/geocode";
import { LandmarkListItem } from "./LandmarkListItem";
import { formatDistance } from "../lib/distance";
import { getRecentSearches, addRecentSearch } from "../lib/recentSearches";
import "./SearchDrawer.css";

interface NearestStart {
  landmark: Landmark;
  distanceMeters: number;
}

export interface PlacePick {
  name: string;
  lat: number;
  lng: number;
  /** True for one of our 15 curated Zone 1 landmarks — false for anywhere else. */
  isHub: boolean;
}

interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
  hubLandmarks: Landmark[];
  nearestStart: NearestStart | null;
  outsideZoneMeters: number;
  fromPick: PlacePick | null;
  onPickFrom: (pick: PlacePick | null) => void;
  onPickTo: (pick: PlacePick) => void;
}

const GEOCODE_DEBOUNCE_MS = 350;

function toPick(landmark: Landmark): PlacePick {
  return { name: landmark.name, lat: landmark.lat, lng: landmark.lng, isHub: true };
}

function geocodeToPick(result: GeocodeResult): PlacePick {
  return { name: result.name, lat: result.lat, lng: result.lng, isHub: false };
}

/**
 * "Side page to search for the exact place" — a panel that slides in over
 * the world map, not a screen you land on. Two fields: From (defaults to
 * "Your location", but any place can override it) and To (required) — so
 * a trip can start and end anywhere, not just at one of our 15 Zone 1
 * landmarks. Typing searches both the curated list and any real place via
 * live geocoding, merged into one list, the way Google Maps does it.
 */
export function SearchDrawer({
  open,
  onClose,
  hubLandmarks,
  nearestStart,
  outsideZoneMeters,
  fromPick,
  onPickFrom,
  onPickTo,
}: SearchDrawerProps) {
  const [activeField, setActiveField] = useState<"from" | "to">("to");
  const [query, setQuery] = useState("");
  const [geocoded, setGeocoded] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<PlacePick[]>([]);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setRecents(getRecentSearches());
    } else {
      setQuery("");
      setGeocoded([]);
      setActiveField("to");
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const needle = query.trim();
    if (needle.length < 3) {
      setGeocoded([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const results = await searchPlaces(needle, { signal: controller.signal });
      setGeocoded(results);
      setSearching(false);
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const needle = query.trim().toLowerCase();
  const hubMatches = needle
    ? hubLandmarks.filter(
        (l) =>
          l.name.toLowerCase().includes(needle) ||
          l.alias.some((a) => a.toLowerCase().includes(needle))
      )
    : hubLandmarks;

  const hubNames = new Set(hubMatches.map((l) => l.name.toLowerCase()));
  const otherMatches = geocoded.filter((g) => !hubNames.has(g.name.toLowerCase()));
  const showRecents = query ? [] : recents;

  function handlePick(pick: PlacePick) {
    if (activeField === "from") {
      onPickFrom(pick);
      setActiveField("to");
      setQuery("");
      setGeocoded([]);
    } else {
      addRecentSearch(pick);
      onPickTo(pick);
    }
  }

  return (
    <div className={`search-drawer ${open ? "search-drawer--open" : ""}`}>
      <div className="search-drawer__backdrop" onClick={onClose} />
      <div className="search-drawer__panel">
        <div className="search-drawer__top">
          <div>
            <h1 className="search-drawer__title">VisitKla</h1>
            <p className="search-drawer__subtitle">Search any place, not just Zone 1</p>
          </div>
          <button className="search-drawer__close" onClick={onClose} aria-label="Close search">
            ✕
          </button>
        </div>

        <div className="search-drawer__fields">
          <button
            className={`search-drawer__field ${activeField === "from" ? "search-drawer__field--active" : ""}`}
            onClick={() => setActiveField("from")}
          >
            <span className="search-drawer__field-dot search-drawer__field-dot--from" />
            <span className="search-drawer__field-text">
              {fromPick ? fromPick.name : "Your location"}
            </span>
            {fromPick && (
              <span
                className="search-drawer__field-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  onPickFrom(null);
                }}
              >
                ✕
              </span>
            )}
          </button>
          <button
            className={`search-drawer__field ${activeField === "to" ? "search-drawer__field--active" : ""}`}
            onClick={() => setActiveField("to")}
          >
            <span className="search-drawer__field-dot search-drawer__field-dot--to" />
            <span className="search-drawer__field-text search-drawer__field-text--placeholder">
              Where you dey go?
            </span>
          </button>
        </div>

        <input
          className="search-drawer__input"
          placeholder={activeField === "from" ? "Search a starting point…" : "Search any place in Uganda…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCorrect="off"
          autoFocus={open}
        />

        {!query && activeField === "to" && nearestStart && !fromPick && (
          <p
            className={`search-drawer__nearest ${
              nearestStart.distanceMeters > outsideZoneMeters
                ? "search-drawer__nearest--far"
                : ""
            }`}
          >
            {nearestStart.distanceMeters > outsideZoneMeters
              ? `You're ${formatDistance(nearestStart.distanceMeters)} from Zone 1 — search any place above, no need to be nearby.`
              : `Starting near ${nearestStart.landmark.name} (${formatDistance(nearestStart.distanceMeters)} away)`}
          </p>
        )}

        <div className="search-drawer__list">
          {showRecents.length === 0 &&
            hubMatches.length === 0 &&
            otherMatches.length === 0 &&
            !searching && (
              <p className="search-drawer__empty">
                {query ? "No place found for that." : "Zone 1 landmarks below, or search any place above."}
              </p>
            )}

          {showRecents.length > 0 && (
            <>
              <p className="search-drawer__section">Recently searched</p>
              {showRecents.map((pick, i) => (
                <button
                  key={`${pick.name}-${i}`}
                  className="search-drawer__recent-item"
                  onClick={() => handlePick(pick)}
                >
                  <span className="search-drawer__recent-icon">↺</span>
                  <span className="search-drawer__geocode-name">{pick.name}</span>
                </button>
              ))}
            </>
          )}

          {hubMatches.length > 0 && (
            <>
              {(query || showRecents.length > 0) && (
                <p className="search-drawer__section">Zone 1 landmarks</p>
              )}
              {hubMatches.map((landmark) => (
                <LandmarkListItem
                  key={landmark.id}
                  landmark={landmark}
                  onClick={() => handlePick(toPick(landmark))}
                />
              ))}
            </>
          )}

          {(otherMatches.length > 0 || searching) && (
            <>
              <p className="search-drawer__section">
                {searching ? "Searching…" : "Other places"}
              </p>
              {otherMatches.map((result) => (
                <button
                  key={result.id}
                  className="search-drawer__geocode-item"
                  onClick={() => handlePick(geocodeToPick(result))}
                >
                  <span className="search-drawer__geocode-name">{result.name}</span>
                  <span className="search-drawer__geocode-label">{formatPlaceLabel(result.fullLabel)}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
