import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import Constants from "expo-constants";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { getRouteById } from "../data/routes";
import { useUserLocation } from "../hooks/useUserLocation";
import { useNearestStep } from "../hooks/useNearestStep";
import { StoryStepCard } from "../components/StoryStepCard";
import { RouteMap } from "../components/RouteMap";
import { PriceCard } from "../components/PriceCard";
import { speakStep, stopSpeaking, type VoiceLanguage } from "../lib/voice";

type Props = NativeStackScreenProps<RootStackParamList, "Navigation">;

const ARRIVAL_RADIUS_METERS = 40;

export function NavigationScreen({ route: navRoute, navigation }: Props) {
  const { routeId, mode } = navRoute.params;
  const route = getRouteById(routeId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [language, setLanguage] = useState<VoiceLanguage>("en");
  const [showPriceCard, setShowPriceCard] = useState(mode === "boda");
  const spokenIndexRef = useRef(-1);

  const { location } = useUserLocation(true);
  const { nearestIndex } = useNearestStep(location, route?.steps ?? []);

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
    if (spokenIndexRef.current === currentIndex) return;
    spokenIndexRef.current = currentIndex;
    const step = route.steps[currentIndex];
    speakStep(step, {
      isFirst: currentIndex === 0,
      isLast: currentIndex === route.steps.length - 1,
      language,
    });
  }, [currentIndex, language, route]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  if (!route) {
    return (
      <View style={styles.notFound}>
        <Text>Route not found.</Text>
      </View>
    );
  }

  const step = route.steps[currentIndex];
  const isLast = currentIndex === route.steps.length - 1;

  function handleNext() {
    if (isLast) {
      Alert.alert("You have arrived", `Welcome to ${route!.end}.`, [
        { text: "Done", onPress: () => navigation.popToTop() },
      ]);
      return;
    }
    setCurrentIndex((i) => Math.min(i + 1, route!.steps.length - 1));
  }

  function handleReportIssue() {
    const extra = (Constants.expoConfig?.extra ?? {}) as {
      reportIssueWhatsappNumber?: string;
    };
    const number = extra.reportIssueWhatsappNumber ?? "";
    const message = encodeURIComponent(
      `VisitKla report: step "${step.landmark}" on route ${route!.start} → ${route!.end} looks wrong.`
    );
    const url = `https://wa.me/${number}?text=${message}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Could not open WhatsApp", "Please check WhatsApp is installed.")
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.mapWrap}>
        <RouteMap
          steps={route.steps}
          userLocation={location}
          showShortcut={mode === "boda"}
        />
        <Pressable
          style={styles.langToggle}
          onPress={() => setLanguage((l) => (l === "en" ? "lg" : "en"))}
        >
          <Text style={styles.langToggleText}>
            {language === "en" ? "EN" : "LG"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.bottom}>
        {mode === "boda" && showPriceCard && (
          <View style={styles.priceOverlay}>
            <PriceCard
              min={route.boda_price_min}
              max={route.boda_price_max}
              panyaTip={route.panya_tip}
            />
            <Pressable onPress={() => setShowPriceCard(false)}>
              <Text style={styles.dismissText}>Hide price card</Text>
            </Pressable>
          </View>
        )}

        <StoryStepCard
          step={step}
          index={currentIndex}
          total={route.steps.length}
          large
          onNext={handleNext}
          onReportIssue={handleReportIssue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f5f0",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrap: {
    flex: 6,
  },
  langToggle: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(26,26,26,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langToggleText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  bottom: {
    flex: 4,
    padding: 16,
    gap: 12,
  },
  priceOverlay: {
    gap: 4,
  },
  dismissText: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
