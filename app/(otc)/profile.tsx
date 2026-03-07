import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { useThemePreference } from "../../contexts/ThemePreferenceContext";

type TabKey = "listings" | "transactions";

const myListings = [
  {
    id: "l1",
    baseSymbol: "BONK",
    listingId: 1042,
    status: "ACTIVE",
    priceUi: 0.000028,
    remainingUi: 750000,
    quantityUi: 1000000,
    minPurchaseUi: 10000,
    vaultBump: 241,
  },
  {
    id: "l2",
    baseSymbol: "JUP",
    listingId: 1043,
    status: "FILLED",
    priceUi: 0.94,
    remainingUi: 0,
    quantityUi: 55000,
    minPurchaseUi: 55000,
    vaultBump: 188,
  },
  {
    id: "l3",
    baseSymbol: "SOL",
    listingId: 1045,
    status: "ACTIVE",
    priceUi: 142.25,
    remainingUi: 670,
    quantityUi: 800,
    minPurchaseUi: 20,
    vaultBump: 154,
  },
];

const activityData = [
  {
    id: "a1",
    label: "Listing created",
    listingAddress: "8Fa1...2Pq9",
    occurredAt: "Today, 10:42 AM",
  },
  {
    id: "a2",
    label: "Listing purchase",
    listingAddress: "3Gt7...xL0a",
    occurredAt: "Yesterday, 08:13 PM",
  },
  {
    id: "a3",
    label: "Discount offer cancelled",
    listingAddress: "Fk9P...t3Qw",
    occurredAt: "Yesterday, 03:27 PM",
  },
];

const Profile = () => {
  const [tab, setTab] = useState<TabKey>("listings");
  const { themeMode, toggleTheme } = useThemePreference();
  const { account, disconnect } = useMobileWallet();

  const totalListings = myListings.length;
  const activeListings = useMemo(
    () => myListings.filter((l) => l.status === "ACTIVE" && l.remainingUi > 0).length,
    []
  );
  const completedListings = useMemo(
    () => myListings.filter((l) => l.status === "FILLED" || l.remainingUi <= 0).length,
    []
  );

  const addressText = account?.address?.toString();
  const shortAddress = addressText
    ? `${addressText.slice(0, 4)}...${addressText.slice(-4)}`
    : "Wallet not connected";

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.warn("Wallet disconnect failed", error);
    } finally {
      router.replace("/");
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      <View className="mb-4 rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-3 h-20 w-20 items-center justify-center rounded-3xl bg-[#4b6bfb]">
              <MaterialIcons name="person" size={36} color="#fff" />
            </View>
            <View>
              <Text className="text-[10px] font-semibold uppercase tracking-[1.8px] text-[#7d8699] dark:text-[#8f97b5]">
                Profile
              </Text>
              <Text className="mt-1 text-2xl font-bold text-[#1b1f29] dark:text-[#f3f5ff]">{shortAddress}</Text>
              <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">
                DexSwap trader • Escrow protected listings
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleDisconnect}
          className="mt-4 self-start rounded-full bg-[#4b6bfb] px-4 py-2"
        >
          <Text className="text-xs font-semibold text-white">Log out</Text>
        </Pressable>

        <View className="mt-3 flex-row items-center justify-between rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-2">
          <View className="flex-row items-center">
            <MaterialIcons
              name={themeMode === "dark" ? "dark-mode" : "light-mode"}
              size={18}
              color="#1b1f29"
            />
            <Text className="ml-2 text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
              Dark mode
            </Text>
          </View>
          <Switch
            value={themeMode === "dark"}
            onValueChange={toggleTheme}
            trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
            thumbColor={themeMode === "dark" ? "#4b6bfb" : "#f8fafc"}
          />
        </View>
      </View>

      <View className="mb-4 flex-row flex-wrap justify-between">
        {[
          {
            label: "Total listings",
            value: totalListings,
            icon: "attach-money",
            color: "#16a34a",
            bg: "bg-green-500/15",
          },
          {
            label: "Active listings",
            value: activeListings,
            icon: "description",
            color: "#2563eb",
            bg: "bg-blue-500/15",
          },
          {
            label: "Completed listings",
            value: completedListings,
            icon: "trending-up",
            color: "#7c3aed",
            bg: "bg-violet-500/15",
          },
        ].map((item) => (
          <View
            key={item.label}
            className="mb-3 w-[32%] rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-4 shadow-sm"
          >
            <View className={`h-11 w-11 items-center justify-center rounded-2xl ${item.bg}`}>
              <MaterialIcons name={item.icon as any} size={20} color={item.color} />
            </View>
            <Text className="mt-3 text-xl font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{item.value}</Text>
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="mb-4 self-start rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] p-1">
          <View className="flex-row">
            <Pressable
              onPress={() => setTab("listings")}
              className={`rounded-full px-4 py-2 ${
                tab === "listings" ? "bg-[#4b6bfb]" : ""
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  tab === "listings" ? "text-white" : "text-[#7d8699] dark:text-[#8f97b5]"
                }`}
              >
                My listings
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab("transactions")}
              className={`rounded-full px-4 py-2 ${
                tab === "transactions" ? "bg-[#4b6bfb]" : ""
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  tab === "transactions" ? "text-white" : "text-[#7d8699] dark:text-[#8f97b5]"
                }`}
              >
                Transaction history
              </Text>
            </Pressable>
          </View>
        </View>

        {tab === "listings" ? (
          <View className="rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] p-4">
            <Text className="mb-3 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">My listings</Text>
            {myListings.map((listing) => (
              <View
                key={listing.id}
                className="mb-3 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-4"
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-base font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      ${listing.baseSymbol}
                    </Text>
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Listing #{listing.listingId}</Text>
                  </View>
                  <View className="rounded-full border border-[#e2e6f0] dark:border-[#30384c] px-3 py-1">
                    <Text className="text-[10px] font-semibold uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
                      {listing.status}
                    </Text>
                  </View>
                </View>

                <View className="mt-3 flex-row flex-wrap justify-between">
                  <View className="mb-2 w-[48%]">
                    <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Price</Text>
                    <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      ${listing.priceUi.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC
                    </Text>
                  </View>
                  <View className="mb-2 w-[48%]">
                    <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Remaining</Text>
                    <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      {listing.remainingUi.toLocaleString()} {listing.baseSymbol}
                    </Text>
                  </View>
                  <View className="mb-2 w-[48%]">
                    <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Total</Text>
                    <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      {listing.quantityUi.toLocaleString()} {listing.baseSymbol}
                    </Text>
                  </View>
                  <View className="mb-2 w-[48%]">
                    <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Min. purchase</Text>
                    <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      {listing.minPurchaseUi.toLocaleString()} {listing.baseSymbol}
                    </Text>
                  </View>
                </View>

                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Vault bump {listing.vaultBump}</Text>
                  <Pressable className="flex-row items-center rounded-full border border-[#e2e6f0] dark:border-[#30384c] px-3 py-1">
                    <Text className="text-xs font-semibold text-[#4b6bfb]">Manage</Text>
                    <MaterialIcons name="north-east" size={14} color="#4b6bfb" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] p-4">
            <Text className="mb-3 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Transaction history</Text>
            {activityData.map((activity) => (
              <View
                key={activity.id}
                className="mb-3 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-3"
              >
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{activity.label}</Text>
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">
                      Listing {activity.listingAddress} · {activity.occurredAt}
                    </Text>
                  </View>
                  <Pressable className="flex-row items-center rounded-full border border-[#e2e6f0] dark:border-[#30384c] px-3 py-1">
                    <Text className="text-xs font-semibold text-[#4b6bfb]">Solscan</Text>
                    <MaterialIcons name="north-east" size={14} color="#4b6bfb" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
      <View className="h-2" />
    </ScrollView>
  );
};

export default Profile;
