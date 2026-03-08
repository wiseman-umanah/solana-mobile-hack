import React from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { clusterApiUrl } from "@solana/web3.js";
import { MobileWalletProvider } from "@wallet-ui/react-native-web3js";
import { BackendAuthProvider } from "../contexts/BackendAuthContext";
import "../global.css";

const chain = "solana:devnet";
const endpoint = clusterApiUrl("devnet");
const identity = {
  name: "OTC Marketplace",
  uri: "https://otc-marketplace.vercel.app",
  icon: "../assets/icon.png",
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <MobileWalletProvider chain={chain} endpoint={endpoint} identity={identity}>
        <BackendAuthProvider>
          <SafeAreaView style={{ flex: 1 }} edges={["left", "right"]}>
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
        </BackendAuthProvider>
      </MobileWalletProvider>
    </SafeAreaProvider>
  );
}
