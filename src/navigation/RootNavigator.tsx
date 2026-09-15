import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NavMode } from "../types";
import { SearchScreen } from "../screens/SearchScreen";
import { RoutePreviewScreen } from "../screens/RoutePreviewScreen";
import { NavigationScreen } from "../screens/NavigationScreen";

export type RootStackParamList = {
  Search: undefined;
  RoutePreview: { routeId: string };
  Navigation: { routeId: string; mode: NavMode };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Search">
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ title: "VisitKla" }}
        />
        <Stack.Screen
          name="RoutePreview"
          component={RoutePreviewScreen}
          options={{ title: "Route" }}
        />
        <Stack.Screen
          name="Navigation"
          component={NavigationScreen}
          options={{ title: "Navigating", headerBackVisible: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
