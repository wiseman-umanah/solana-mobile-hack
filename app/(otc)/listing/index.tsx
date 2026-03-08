import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useListings } from "../../../hooks/useListings";

type FillMode = "all" | "partial" | "full";
type StatusMode = "all" | "active" | "pending" | "filled";

const ListingMarket = () => {
  const { listings, loading, error, refresh } = useListings();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusMode>("all");
  const [fillFilter, setFillFilter] = useState<FillMode>("all");

  const filteredListings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesSearch =
        !needle ||
        listing.baseSymbol.toLowerCase().includes(needle) ||
        listing.sellerAddress.toLowerCase().includes(needle) ||
        listing.address.toLowerCase().includes(needle);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && listing.status === "ACTIVE") ||
        (statusFilter === "pending" && listing.status === "PENDING") ||
        (statusFilter === "filled" && listing.status === "FILLED");

      const matchesFill =
        fillFilter === "all" ||
        (fillFilter === "partial" && listing.allowPartial) ||
        (fillFilter === "full" && !listing.allowPartial);

      return matchesSearch && matchesStatus && matchesFill;
    });
  }, [search, statusFilter, fillFilter, listings]);

  const activeCount = filteredListings.length;
  const uniqueSellers = useMemo(
    () => new Set(filteredListings.map((l) => l.sellerAddress)).size,
    [filteredListings]
  );
  const totalLiquidity = useMemo(
    () => filteredListings.reduce((acc, l) => acc + l.remainingUi * l.priceUi, 0),
    [filteredListings]
  );
  const partialFriendly = useMemo(
    () => filteredListings.filter((l) => l.allowPartial).length,
    [filteredListings]
  );

  const shortAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;
  const formatCurrency = (value: number, digits = 2) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: digits,
    }).format(value);

  return (
    <ScrollView
      className="flex-1 bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <View className="mb-4 rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="self-start rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-1">
          <Text className="text-[10px] font-semibold uppercase tracking-[1.8px] text-[#7d8699] dark:text-[#8f97b5]">
            DexSwap OTC
          </Text>
        </View>
        <Text className="mt-3 text-2xl font-bold text-[#1b1f29] dark:text-[#f3f5ff]">
          Discover vetted liquidity with confidence.
        </Text>
        <Text className="mt-2 text-sm text-[#7d8699] dark:text-[#8f97b5]">
          Browse curated OTC opportunities and compare listing terms quickly.
        </Text>

        <View className="mt-4 flex-row flex-wrap justify-between">
          <View className="mb-2 w-[32%] rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
            <MaterialIcons name="layers" size={18} color="#16a34a" />
            <Text className="mt-2 text-lg font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{activeCount}</Text>
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Active</Text>
          </View>
          <View className="mb-2 w-[32%] rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
            <MaterialIcons name="people-outline" size={18} color="#2563eb" />
            <Text className="mt-2 text-lg font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{uniqueSellers}</Text>
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Sellers</Text>
          </View>
          <View className="mb-2 w-[32%] rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
            <MaterialIcons name="attach-money" size={18} color="#d97706" />
            <Text className="mt-2 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
              {formatCurrency(totalLiquidity, totalLiquidity >= 1000 ? 0 : 2)}
            </Text>
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Liquidity</Text>
          </View>
        </View>
      </View>

      <View className="mb-4 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-4 shadow-sm">
        <View className="mb-3 flex-row items-center rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3">
          <MaterialIcons name="search" size={18} color="#7d8699" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search token or seller..."
            placeholderTextColor="#7d8699"
            className="ml-2 h-11 flex-1 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {[
              { value: "all", label: "All", type: "status" },
              { value: "active", label: "Active", type: "status" },
              { value: "pending", label: "Pending", type: "status" },
              { value: "filled", label: "Filled", type: "status" },
              { value: "partial", label: "Partial Fill", type: "fill" },
              { value: "full", label: "Full Fill", type: "fill" },
            ].map((chip) => {
              const selected =
                chip.type === "status"
                  ? statusFilter === (chip.value as StatusMode)
                  : fillFilter === (chip.value as FillMode);
              return (
                <Pressable
                  key={`${chip.type}-${chip.value}`}
                  onPress={() => {
                    if (chip.type === "status") setStatusFilter(chip.value as StatusMode);
                    else setFillFilter(chip.value as FillMode);
                  }}
                  className={`rounded-full border px-3 py-2 ${
                    selected
                      ? "border-[#4b6bfb] bg-[#4b6bfb]/10"
                      : "border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      selected ? "text-[#4b6bfb]" : "text-[#7d8699] dark:text-[#8f97b5]"
                    }`}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View className="mt-3 flex-row items-center justify-between border-t border-dashed border-[#e2e6f0] dark:border-[#30384c] pt-3">
          <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">
            Showing <Text className="font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{activeCount}</Text> curated listings
          </Text>
          <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">{partialFriendly} partial-fill friendly</Text>
        </View>
      </View>

      {loading ? (
        <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-8 py-12">
          <Text className="text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">Loading listings...</Text>
        </View>
      ) : error ? (
        <View className="rounded-3xl border border-red-500/30 bg-red-500/10 px-8 py-12">
          <Text className="text-center text-sm text-red-700 dark:text-red-300">{error}</Text>
        </View>
      ) : filteredListings.length === 0 ? (
        <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-8 py-12">
          <View className="mx-auto h-16 w-16 items-center justify-center rounded-full bg-[#f1f3f8] dark:bg-[#1f2431]">
            <MaterialIcons name="search" size={28} color="#7d8699" />
          </View>
          <Text className="mt-5 text-center text-xl font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
            No listings match your filters
          </Text>
          <Text className="mt-2 text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">
            Adjust search or filter settings to broaden inventory.
          </Text>
        </View>
      ) : (
        filteredListings.map((listing) => {
          const progress = listing.quantityUi > 0 ? (listing.filledUi / listing.quantityUi) * 100 : 0;
          const remainingValue = listing.remainingUi * listing.priceUi;
          return (
            <View
              key={listing.address}
              className="mb-4 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">
                  Seller: {shortAddress(listing.sellerAddress)}
                </Text>
                <Pressable className="h-8 w-8 items-center justify-center rounded-full">
                  <MaterialIcons name="more-vert" size={18} color="#7d8699" />
                </Pressable>
              </View>

              <View className="mt-2">
                <Text className="text-2xl font-bold text-[#1b1f29] dark:text-[#f3f5ff]">${listing.baseSymbol}</Text>
                <Text className="text-sm text-[#7d8699] dark:text-[#8f97b5]">Listing ID #{listing.listingId}</Text>
                <Text className="mt-1 text-xs text-[#7d8699] dark:text-[#8f97b5]">
                  {listing.remainingUi.toLocaleString()} tokens available · Min order {" "}
                  {Math.min(listing.minPurchaseUi, listing.remainingUi).toLocaleString()}
                </Text>
              </View>

              <View className="mt-3 flex-row items-center gap-2">
                <View
                  className={`rounded-full border px-2 py-1 ${
                    listing.allowPartial
                      ? "border-green-500/30 bg-green-500/20"
                      : "border-blue-500/30 bg-blue-500/20"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      listing.allowPartial ? "text-green-600" : "text-blue-600"
                    }`}
                  >
                    {listing.allowPartial ? "Partial fills allowed" : "Full fill required"}
                  </Text>
                </View>
                <View
                  className={`rounded-full px-2 py-1 ${
                    listing.status === "ACTIVE"
                      ? "bg-[#4b6bfb]/10"
                      : listing.status === "FILLED"
                      ? "bg-green-500/10"
                      : "bg-amber-500/15"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      listing.status === "ACTIVE"
                        ? "text-[#4b6bfb]"
                        : listing.status === "FILLED"
                        ? "text-green-600"
                        : "text-amber-700"
                    }`}
                  >
                    {listing.status}
                  </Text>
                </View>
              </View>

              <View className="mt-4">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Sold</Text>
                  <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">
                    {listing.filledUi.toLocaleString()} / {listing.quantityUi.toLocaleString()}
                  </Text>
                </View>
                <View className="h-2.5 overflow-hidden rounded-full bg-[#dbe3f3]">
                  <View className="h-2.5 rounded-full bg-[#4b6bfb]" style={{ width: `${progress}%` }} />
                </View>
              </View>

              <View className="mt-4 flex-row gap-2">
                <Pressable
                  onPress={() => router.push(`/(otc)/listing/${listing.address}`)}
                  className="flex-1 flex-row items-center justify-center rounded-lg bg-[#4b6bfb] px-3 py-2"
                >
                  <MaterialIcons name="visibility" size={16} color="#fff" />
                  <Text className="ml-1 text-sm font-semibold text-white">View Details</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(otc)/message",
                      params: { recipient: listing.sellerAddress },
                    })
                  }
                  className="flex-1 flex-row items-center justify-center rounded-lg border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-2"
                >
                  <MaterialIcons name="chat-bubble-outline" size={16} color="#1b1f29" />
                  <Text className="ml-1 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Message</Text>
                </Pressable>
              </View>

              <View className="mt-4 flex-row items-center justify-between border-t border-[#e2e6f0] dark:border-[#30384c] pt-3">
                <View>
                  <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Price per token</Text>
                  <Text className="text-base font-bold text-[#1b1f29] dark:text-[#f3f5ff]">
                    {formatCurrency(listing.priceUi, 4)}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Value remaining</Text>
                  <Text className="text-base font-bold text-green-600">
                    {formatCurrency(remainingValue, remainingValue >= 1000 ? 0 : 2)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

export default ListingMarket;
