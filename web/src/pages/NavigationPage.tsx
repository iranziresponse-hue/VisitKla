import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUserLocation } from "../hooks/useUserLocation";
import { useResolvedRoute } from "../hooks/useResolvedRoute";
import { useNearestStep } from "../hooks/useNearestStep";
import { NavigationInstructionCard } from "../components/NavigationInstructionCard";
import { ApproachCard } from "../components/ApproachCard";
import { NavigationMap } from "../components/NavigationMap";
import { TurnReminder } from "../components/TurnReminder";
import { BackButton } from "../components/BackButton";
import { speakStep, stopSpeaking, getSpokenText, type VoiceLanguage } from "../lib/voice";
import { haversineMeters } from "../lib/distance";
import { createRideAudio, type RideAudio } from "../lib/rideAudio";
import { findLandmarkByName } from "../data/landmarks";
import "./NavigationPage.css";

// Real turn-by-turn only starts once GPS says we're within this radius of
// the fixed route's first landmark — otherwise we're honest that the route
// begins somewhere else, instead of narrating "Start at X" fiction.
const APPROACH_THRESHOLD_METERS = 120;
// Inside this radius the next landmark stops being "ahead" and becomes
// "right here" — the moment a boda guy would actually call the turn.
const IMMINENT_METERS = 70;

export function NavigationPage() {
  const { routeId = "", mode = "landmark" } = useParams();
  const navigate = useNavigate();
  const { route, precomputedPath } = useResolvedRoute(routeId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [language, setLanguage] = useState<VoiceLanguage>("en");
  const [arrived, setArrived] = useState(false);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const spokenIndexRef = useRef("");
  const spokenApproachRef = useRef(false);
  const audioRef = useRef<RideAudio | null>(null);
  const chimedIndexRef = useRef(-1);

  const { location } = useUserLocation(true);
  const { nearestIndex } = useNearestStep(location, route?.steps ?? []);

  useEffect(() => {
    const audio = createRideAudio();
    audioRef.current = audio;
    audio?.resume();
    return () => {
      audio?.dispose();
      audioRef.current = null;
    };
  }, []);

  const distanceToFirstStep =
    location && route
      ? haversineMeters(
          location.latitude,
          location.longitude,
          route.steps[0].lat,
          route.steps[0].lng
        )
      : null;

  const isApproaching =
    !journeyStarted &&
    distanceToFirstStep !== null &&
    distanceToFirstStep > APPROACH_THRESHOLD_METERS;

  // Once GPS confirms we're close enough to the fixed route's start (or
  // already nearer to a later step than step 0), latch into real
  // turn-by-turn permanently — never flip back to "approaching" just
  // because the user later wanders away from a landmark.
  useEffect(() => {
    if (journeyStarted) return;
    if (nearestIndex > 0) {
      setJourneyStarted(true);
      return;
    }
    if (distanceToFirstStep !== null && distanceToFirstStep <= APPROACH_THRESHOLD_METERS) {
      setJourneyStarted(true);
    }
  }, [journeyStarted, nearestIndex, distanceToFirstStep]);

  // GPS-driven auto-advance: only ever move forward, never snap back to an
  // earlier step just because the user is momentarily closer to it (e.g.
  // waiting at a junction near the previous landmark).
  useEffect(() => {
    if (nearestIndex > currentIndex) {
      setCurrentIndex(nearestIndex);
    }
  }, [nearestIndex, currentIndex]);

  useEffect(() => {
    if (!route) return;
    if (isApproaching) {
      if (spokenApproachRef.current) return;
      spokenApproachRef.current = true;
      stopSpeaking();
      return;
    }
    // Keyed on language too, not just the step index — switching the
    // EN/LG toggle mid-step should say the current instruction again in
    // the new language, not stay silent until the next landmark.
    const spokenKey = `${currentIndex}:${language}`;
    if (spokenIndexRef.current === spokenKey) return;
    spokenIndexRef.current = spokenKey;
    const step = route.steps[currentIndex];

    // A sound cue keyed to what you're passing — horns at a junction,
    // market chatter at the market — then the spoken instruction.
    if (chimedIndexRef.current !== currentIndex) {
      chimedIndexRef.current = currentIndex;
      const isFinal = currentIndex === route.steps.length - 1;
      audioRef.current?.cue(
        isFinal
          ? "arrive"
          : (findLandmarkByName(step.landmark)?.type ?? "landmark")
      );
    }

    speakStep(step, {
      isFirst: currentIndex === 0,
      isLast: currentIndex === route.steps.length - 1,
      language,
    });
  }, [currentIndex, language, route, isApproaching]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  if (!route) {
    return (
      <div className="navigation-page navigation-page--empty">
        <p>Route not found.</p>
        <button onClick={() => navigate("/")}>Back to search</button>
      </div>
    );
  }

  const step = route.steps[currentIndex];
  const isLast = currentIndex === route.steps.length - 1;

  // What you're heading for next — the thing to actually watch out for.
  const upcomingStep = isLast ? step : route.steps[currentIndex + 1];
  const distanceToUpcoming = location
    ? haversineMeters(
        location.latitude,
        location.longitude,
        upcomingStep.lat,
        upcomingStep.lng
      )
    : null;
  const imminent =
    distanceToUpcoming !== null && distanceToUpcoming <= IMMINENT_METERS;

  function handleNext() {
    if (isApproaching) {
      setJourneyStarted(true);
      return;
    }
    if (isLast) {
      setArrived(true);
      return;
    }
    setCurrentIndex((i) => Math.min(i + 1, route!.steps.length - 1));
  }

  function handleReportIssue() {
    // Real default so reporting works out of the box with no env setup —
    // still overridable via VITE_REPORT_WHATSAPP_NUMBER for a different deploy.
    const number = import.meta.env.VITE_REPORT_WHATSAPP_NUMBER ?? "256777547534";
    const message = encodeURIComponent(
      `VisitKla report: step "${step.landmark}" on route ${route!.start} → ${route!.end} looks wrong.`
    );
    window.open(`https://wa.me/${number}?text=${message}`, "_blank");
  }

  return (
    <div className="navigation-page">
      <div className="navigation-page__map">
        <NavigationMap
          steps={route.steps}
          userLocation={location}
          activeIndex={currentIndex}
          showShortcut={mode === "boda"}
          approachTarget={isApproaching ? route.steps[0] : null}
          precomputedPath={precomputedPath}
        />
        <BackButton onClick={() => navigate(-1)} />
        <button
          className="navigation-page__lang-toggle"
          onClick={() => setLanguage((l) => (l === "en" ? "lg" : "en"))}
        >
          {language === "en" ? "EN" : "LG"}
        </button>
      </div>

      <div className="navigation-page__sheet">
        <div className="navigation-page__sheet-scroll">
          {isApproaching && distanceToFirstStep !== null ? (
            <ApproachCard target={route.steps[0]} distanceMeters={distanceToFirstStep} />
          ) : (
            <>
              {!isLast && (
                <TurnReminder
                  step={upcomingStep}
                  distanceMeters={distanceToUpcoming}
                  imminent={imminent}
                />
              )}
              <NavigationInstructionCard
                step={step}
                index={currentIndex}
                total={route.steps.length}
                text={getSpokenText(step, {
                  isFirst: currentIndex === 0,
                  isLast,
                  language,
                })}
              />
            </>
          )}
        </div>

        <div className="navigation-page__actions">
          <button className="navigation-page__report" onClick={handleReportIssue}>
            This is wrong?
          </button>
          <button className="navigation-page__next" onClick={handleNext}>
            {isApproaching
              ? "Continue anyway"
              : isLast
                ? "Arrived"
                : "Next"}
          </button>
        </div>
      </div>

      {arrived && (
        <div className="navigation-page__arrived-overlay">
          <div className="navigation-page__arrived-card">
            <p className="navigation-page__arrived-title">You have arrived</p>
            <p className="navigation-page__arrived-subtitle">
              Welcome to {route.end}.
            </p>
            <button
              className="navigation-page__arrived-btn"
              onClick={() => navigate("/")}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
