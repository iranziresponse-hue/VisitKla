import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { Landmark } from "../types";
import { HUB_LANDMARKS, findRoute, getRoutesEndingAt, getRoutesStartingAt } from "../data/routes";
import { LandmarkListItem } from "../components/LandmarkListItem";
import { useUserLocation } from "../hooks/useUserLocation";
import { haversineMeters } from "../lib/distance";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

const DEFAULT_START = "Makerere Main Gate";

function nearestHubLandmark(
  userLat: number,
  userLng: number,
  exclude?: string
): Landmark {
  let best = HUB_LANDMARKS[0];
  let bestDist = Infinity;
  for (const l of HUB_LANDMARKS) {
    if (l.name === exclude) continue;
    const d = haversineMeters(userLat, userLng, l.lat, l.lng);
    if (d < bestDist) {
      bestDist = d;
      best = l;
    }
  }
  return best;
}

export function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const { location } = useUserLocation(false);

  const filteredLandmarks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return HUB_LANDMARKS;
    return HUB_LANDMARKS.filter(
      (l) =>
        l.name.toLowerCase().includes(needle) ||
        l.alias.some((a) => a.toLowerCase().includes(needle))
    );
  }, [query]);

  function handleSelectLandmark(destination: Landmark) {
    const startName = location
      ? nearestHubLandmark(
          location.latitude,
          location.longitude,
          destination.name
        ).name
      : DEFAULT_START;

    const route =
      findRoute(startName, destination.name) ??
      getRoutesEndingAt(destination.name)[0] ??
      getRoutesStartingAt(destination.name)[0];

    if (!route) {
      Alert.alert(
        "No route yet",
        `VisitKla only covers Zone 1 (Makerere, Wandegeya, Mulago, Town) in this MVP. No route to ${destination.name} yet.`
      );
      return;
    }

    navigation.navigate("RoutePreview", { routeId: route.id });
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>VisitKla</Text>
        <Text style={styles.subtitle}>
          Kampala navigation by landmarks, not street names
        </Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Where you dey go?"
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />

      <FlatList
        data={filteredLandmarks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <LandmarkListItem
            landmark={item}
            onPress={() => handleSelectLandmark(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No landmark matches that. Zone 1 only for now: Makerere,
            Wandegeya, Mulago, Town.
          </Text>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f5f0",
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 13,
    color: "#777",
    marginTop: 2,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    paddingHorizontal: 20,
  },
});
