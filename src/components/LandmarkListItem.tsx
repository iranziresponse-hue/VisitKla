import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import type { Landmark } from "../types";

interface LandmarkListItemProps {
  landmark: Landmark;
  onPress: () => void;
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

export function LandmarkListItem({ landmark, onPress }: LandmarkListItemProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Image source={{ uri: landmark.photo_url }} style={styles.thumb} />
      <View style={styles.info}>
        <Text style={styles.name}>{landmark.name}</Text>
        <Text style={styles.type}>{TYPE_LABELS[landmark.type] ?? landmark.type}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  type: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: "#ccc",
  },
});
