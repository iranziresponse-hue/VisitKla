import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import type { RouteStep } from "../types";

interface StoryStepCardProps {
  step: RouteStep;
  index: number; // 0-based
  total: number;
  /** Bigger text + bigger photo, used on the Active Navigation screen. */
  large?: boolean;
  onNext?: () => void;
  onReportIssue?: () => void;
}

export function StoryStepCard({
  step,
  index,
  total,
  large = false,
  onNext,
  onReportIssue,
}: StoryStepCardProps) {
  const isLast = index === total - 1;

  return (
    <View style={[styles.card, large && styles.cardLarge]}>
      <View style={styles.progressRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i <= index && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <Image
        source={{ uri: step.photo_url }}
        style={[styles.photo, large && styles.photoLarge]}
        resizeMode="cover"
      />

      <View style={styles.body}>
        <Text style={styles.landmarkBadge}>
          STEP {index + 1} OF {total} · {step.landmark.toUpperCase()}
        </Text>
        <Text style={[styles.stepText, large && styles.stepTextLarge]}>
          {step.text}
        </Text>
      </View>

      <View style={styles.actionsRow}>
        {onReportIssue && (
          <Pressable style={styles.reportButton} onPress={onReportIssue}>
            <Text style={styles.reportButtonText}>This is wrong?</Text>
          </Pressable>
        )}
        {onNext && (
          <Pressable style={styles.nextButton} onPress={onNext}>
            <Text style={styles.nextButtonText}>
              {isLast ? "Arrived" : "Next"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardLarge: {
    flex: 1,
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    padding: 8,
    paddingBottom: 4,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e5e5e5",
  },
  progressDotActive: {
    backgroundColor: "#ff6b00",
  },
  photo: {
    width: "100%",
    height: 160,
    backgroundColor: "#eee",
  },
  photoLarge: {
    height: 200,
  },
  body: {
    padding: 16,
    flexGrow: 1,
  },
  landmarkBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ff6b00",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  stepText: {
    fontSize: 17,
    lineHeight: 24,
    color: "#1a1a1a",
    fontWeight: "600",
  },
  stepTextLarge: {
    fontSize: 24,
    lineHeight: 32,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  reportButton: {
    paddingVertical: 8,
  },
  reportButtonText: {
    color: "#999",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  nextButton: {
    flex: 1,
    backgroundColor: "#ff6b00",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  nextButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
