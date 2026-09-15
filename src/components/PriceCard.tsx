import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface PriceCardProps {
  min: number;
  max: number;
  panyaTip?: string;
}

function formatUgx(amount: number): string {
  return amount.toLocaleString("en-UG");
}

export function PriceCard({ min, max, panyaTip }: PriceCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Boda fare guide</Text>
      <Text style={styles.priceText}>
        Should be {formatUgx(min)} - {formatUgx(max)} UGX, not 7k+
      </Text>
      <Text style={styles.subtext}>
        Fair price for this trip. Agree before you climb on.
      </Text>
      {panyaTip ? (
        <View style={styles.tipBox}>
          <Text style={styles.tipLabel}>Panya route tip</Text>
          <Text style={styles.tipText}>{panyaTip}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff7ed",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ffd9a8",
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b45309",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  priceText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  subtext: {
    fontSize: 13,
    color: "#7a5a2f",
    marginTop: 4,
  },
  tipBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ffd9a8",
  },
  tipLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    color: "#1a1a1a",
    lineHeight: 20,
  },
});
