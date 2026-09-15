import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  Pressable,
  StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { getRouteById } from "../data/routes";
import { RouteMap } from "../components/RouteMap";
import { StoryStepCard } from "../components/StoryStepCard";
import { PriceCard } from "../components/PriceCard";

type Props = NativeStackScreenProps<RootStackParamList, "RoutePreview">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 32;

export function RoutePreviewScreen({ route: navRoute, navigation }: Props) {
  const { routeId } = navRoute.params;
  const route = useMemo(() => getRouteById(routeId), [routeId]);

  if (!route) {
    return (
      <View style={styles.notFound}>
        <Text>Route not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.mapWrap}>
        <RouteMap steps={route.steps} />
      </View>

      <View style={styles.headline}>
        <Text style={styles.headlineText}>
          {route.start} → {route.end}
        </Text>
        <Text style={styles.headlineSub}>
          {route.steps.length} landmarks · swipe the cards below
        </Text>
      </View>

      <FlatList
        data={route.steps}
        keyExtractor={(s) => `${s.order}-${s.landmark}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        contentContainerStyle={styles.storyList}
        renderItem={({ item, index }) => (
          <View style={{ width: CARD_WIDTH, marginRight: 16 }}>
            <StoryStepCard step={item} index={index} total={route.steps.length} />
          </View>
        )}
      />

      <View style={styles.bottom}>
        <PriceCard
          min={route.boda_price_min}
          max={route.boda_price_max}
          panyaTip={route.panya_tip}
        />

        <View style={styles.buttonsRow}>
          <Pressable
            style={[styles.button, styles.landmarkButton]}
            onPress={() =>
              navigation.navigate("Navigation", { routeId: route.id, mode: "landmark" })
            }
          >
            <Text style={styles.buttonText}>Start Landmark Navigation</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.bodaButton]}
            onPress={() =>
              navigation.navigate("Navigation", { routeId: route.id, mode: "boda" })
            }
          >
            <Text style={styles.buttonText}>
              Boda Mode · {Math.round(route.boda_price_min / 1000)}k-
              {Math.round(route.boda_price_max / 1000)}k
            </Text>
          </Pressable>
        </View>
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
    height: 220,
  },
  headline: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headlineText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  headlineSub: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  storyList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bottom: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  landmarkButton: {
    backgroundColor: "#1a1a1a",
  },
  bodaButton: {
    backgroundColor: "#16a34a",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
});
