import React from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { clusterApiUrl } from "@solana/web3.js";
import { MobileWalletProvider } from "@wallet-ui/react-native-web3js";
import "../global.css";

const chain = "solana:devnet";
const endpoint = clusterApiUrl("devnet");
const identity = {
  name: "OTC Marketplace",
  uri: "https://otc-marketplace.vercel.app",
  icon: "favicon.ico",
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <MobileWalletProvider chain={chain} endpoint={endpoint} identity={identity}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: "transparent",
              },
              animation: Platform.OS === "ios" ? "default" : "fade",
            }}
          />
        </SafeAreaView>
      </MobileWalletProvider>
    </SafeAreaProvider>
  );
}
