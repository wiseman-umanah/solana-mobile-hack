import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { useThemePreference } from "../../contexts/ThemePreferenceContext";
import { useListings } from "../../hooks/useListings";
import { getWalletPublicKey } from "../../lib/wallet";
import { useBackendAuth } from "../../contexts/BackendAuthContext";
import { getBackendBaseUrl } from "../../lib/backendAuth";

type TabKey = "listings" | "transactions";

type BackendActivity = {
  _id?: string;
  listingAddress: string;
  txHash: string;
  type: string;
  occurredAt?: string;
  createdAt?: string;
};

const ACTIVITY_LABELS: Record<string, string> = {
  CREATE: "Listing created",
  PURCHASE: "Listing purchase",
  DISCOUNT_PURCHASE: "Listing discount bought",
  DISCOUNT_CANCELLED: "Discount offer cancelled",
};

const Profile = () => {
  const [tab, setTab] = useState<TabKey>("listings");
  const { themeMode, toggleTheme } = useThemePreference();
  const { account, disconnect } = useMobileWallet();
  const { listings, loading: listingsLoading, refresh: refreshListings } = useListings();
  const { ensureAuth, clearAuth } = useBackendAuth();

  const walletPublicKey = useMemo(() => getWalletPublicKey(account ?? null), [account]);
  const walletAddress = walletPublicKey?.toBase58() ?? null;

  const [activities, setActivities] = useState<BackendActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!walletAddress) {
      setActivities([]);
      return;
    }

    setActivityLoading(true);
    setActivityError(null);
    try {
      const token = await ensureAuth();
      if (!token) return;

      const res = await fetch(`${getBackendBaseUrl()}/api/listings/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to load activity (${res.status})`);
      }

      const payload = await res.json();
      const next: BackendActivity[] = payload?.activities ?? [];
      setActivities(next);
    } catch (error) {
      console.error("Failed to fetch listing activity", error);
      setActivityError("Unable to load transaction history right now.");
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  }, [walletAddress, ensureAuth]);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  const myListings = useMemo(
    () => (walletAddress ? listings.filter((listing) => listing.sellerAddress === walletAddress) : []),
    [listings, walletAddress]
  );

  const totalListings = myListings.length;
  const activeListings = useMemo(
    () => myListings.filter((listing) => listing.status === "ACTIVE" && listing.remainingUi > 0).length,
    [myListings]
  );
  const completedListings = useMemo(
    () => myListings.filter((listing) => listing.status === "FILLED" || listing.remainingUi <= 0).length,
    [myListings]
  );

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : "Wallet not connected";

  const handleDisconnect = async () => {
    try {
      clearAuth();
      await disconnect();
    } catch (error) {
      console.warn("Wallet disconnect failed", error);
    } finally {
      router.replace("/");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshListings(), fetchActivity()]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      className="flex-1 bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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

        <Pressable onPress={handleDisconnect} className="mt-4 self-start rounded-full bg-[#4b6bfb] px-4 py-2">
          <Text className="text-xs font-semibold text-white">Log out</Text>
        </Pressable>

        <View className="mt-3 flex-row items-center justify-between rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-2">
          <View className="flex-row items-center">
            <MaterialIcons
              name={themeMode === "dark" ? "dark-mode" : "light-mode"}
              size={18}
              color="#1b1f29"
            />
            <Text className="ml-2 text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Dark mode</Text>
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
              className={`rounded-full px-4 py-2 ${tab === "listings" ? "bg-[#4b6bfb]" : ""}`}
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
              className={`rounded-full px-4 py-2 ${tab === "transactions" ? "bg-[#4b6bfb]" : ""}`}
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
            {listingsLoading ? (
              <View className="rounded-2xl border border-dashed border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-6">
                <Text className="text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">Loading listings...</Text>
              </View>
            ) : myListings.length === 0 ? (
              <View className="rounded-2xl border border-dashed border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-6">
                <Text className="text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">
                  No listings found. Launch a listing to see it here.
                </Text>
              </View>
            ) : (
              myListings.map((listing) => (
                <View
                  key={listing.address}
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
                        {listing.remainingUi.toLocaleString(undefined, { maximumFractionDigits: 4 })} {listing.baseSymbol}
                      </Text>
                    </View>
                    <View className="mb-2 w-[48%]">
                      <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Total</Text>
                      <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                        {listing.quantityUi.toLocaleString(undefined, { maximumFractionDigits: 4 })} {listing.baseSymbol}
                      </Text>
                    </View>
                    <View className="mb-2 w-[48%]">
                      <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Min. purchase</Text>
                      <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                        {listing.minPurchaseUi.toLocaleString(undefined, { maximumFractionDigits: 4 })} {listing.baseSymbol}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Vault bump {listing.vaultBump}</Text>
                    <Pressable
                      onPress={() => router.push(`/(otc)/listing/${listing.address}`)}
                      className="flex-row items-center rounded-full border border-[#e2e6f0] dark:border-[#30384c] px-3 py-1"
                    >
                      <Text className="text-xs font-semibold text-[#4b6bfb]">Manage</Text>
                      <MaterialIcons name="north-east" size={14} color="#4b6bfb" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View className="rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] p-4">
            <Text className="mb-3 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Transaction history</Text>
            {activityLoading ? (
              <View className="rounded-2xl border border-dashed border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-6">
                <Text className="text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">Loading activity...</Text>
              </View>
            ) : activityError ? (
              <View className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <Text className="text-xs text-red-700 dark:text-red-300">{activityError}</Text>
              </View>
            ) : activities.length === 0 ? (
              <View className="rounded-2xl border border-dashed border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-6">
                <Text className="text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">
                  No transactions yet.
                </Text>
              </View>
            ) : (
              activities.map((activity) => {
                const timestamp = new Date(activity.occurredAt ?? activity.createdAt ?? Date.now()).toLocaleString();
                const typeLabel = ACTIVITY_LABELS[activity.type] ?? activity.type;
                const shortListing = activity.listingAddress
                  ? `${activity.listingAddress.slice(0, 4)}...${activity.listingAddress.slice(-4)}`
                  : "Unknown";
                return (
                  <View
                    key={activity._id ?? `${activity.txHash}-${activity.type}`}
                    className="mb-3 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-2">
                        <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{typeLabel}</Text>
                        <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">
                          Listing {shortListing} · {timestamp}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => Linking.openURL(`https://solscan.io/tx/${activity.txHash}?cluster=devnet`)}
                        className="flex-row items-center rounded-full border border-[#e2e6f0] dark:border-[#30384c] px-3 py-1"
                      >
                        <Text className="text-xs font-semibold text-[#4b6bfb]">Solscan</Text>
                        <MaterialIcons name="north-east" size={14} color="#4b6bfb" />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>
      <View className="h-2" />
    </ScrollView>
  );
};

export default Profile;
