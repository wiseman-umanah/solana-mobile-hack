import React, { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { sampleListings } from "./data";

export default function ListingDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const listing = useMemo(
    () => sampleListings.find((item) => item.id === params.id),
    [params.id]
  );

  const formatCurrency = (value: number, digits = 2) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: digits,
    }).format(value);

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f6f7fb] dark:bg-[#10131b] px-6">
        <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-6 py-8">
          <Text className="text-center text-lg font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
            Listing Not Found
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 rounded-xl bg-[#4b6bfb] px-4 py-3"
          >
            <Text className="text-center text-sm font-semibold text-white">Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const progress =
    listing.quantityUi > 0 ? (listing.filledUi / listing.quantityUi) * 100 : 0;
  const remainingValue = listing.remainingUi * listing.priceUi;
  const rating = 4.8;
  const reviewCount = 126;
  const completedTrades = 94;
  const responseTime = "~12 min";

  return (
    <ScrollView
      className="flex-1 bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-4"
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() => router.back()}
        className="mb-3 self-start rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-3 py-2"
      >
        <View className="flex-row items-center">
          <MaterialIcons name="arrow-back" size={16} color="#1b1f29" />
          <Text className="ml-1 text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Back</Text>
        </View>
      </Pressable>

      <View className="mb-4 rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold text-[#1b1f29] dark:text-[#f3f5ff]">${listing.baseSymbol}</Text>
            <Text className="text-sm text-[#7d8699] dark:text-[#8f97b5]">Listing ID #{listing.listingId}</Text>
          </View>
          <View
            className={`rounded-full px-3 py-1 ${
              listing.status === "ACTIVE"
                ? "bg-[#4b6bfb]/10"
                : listing.status === "FILLED"
                ? "bg-green-500/10"
                : "bg-amber-500/15"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
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

        <Text className="mt-3 text-sm text-[#7d8699] dark:text-[#8f97b5]">
          Seller {listing.sellerAddress.slice(0, 6)}...{listing.sellerAddress.slice(-4)}
        </Text>

        <View className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#dbe3f3]">
          <View className="h-2.5 rounded-full bg-[#4b6bfb]" style={{ width: `${progress}%` }} />
        </View>
        <Text className="mt-2 text-xs text-[#7d8699] dark:text-[#8f97b5]">
          {listing.filledUi.toLocaleString()} sold / {listing.quantityUi.toLocaleString()} total
        </Text>
      </View>

      <View className="mb-4 rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <Text className="mb-3 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Listing Stats</Text>
        <View className="flex-row flex-wrap justify-between">
          <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Price per token</Text>
            <Text className="mt-1 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
              {formatCurrency(listing.priceUi, 4)}
            </Text>
          </View>
          <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Remaining tokens</Text>
            <Text className="mt-1 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
              {listing.remainingUi.toLocaleString()}
            </Text>
          </View>
          <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Min. purchase</Text>
            <Text className="mt-1 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
              {Math.min(listing.minPurchaseUi, listing.remainingUi).toLocaleString()}
            </Text>
          </View>
          <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Value remaining</Text>
            <Text className="mt-1 text-sm font-semibold text-green-600">
              {formatCurrency(remainingValue, remainingValue >= 1000 ? 0 : 2)}
            </Text>
          </View>
        </View>
      </View>

      <View className="mb-4 rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Seller Rating</Text>
          <View className="rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-1">
            <Text className="text-[10px] font-semibold uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
              Trusted Seller
            </Text>
          </View>
        </View>

        <View className="mb-3 flex-row items-center">
          <View className="mr-3 flex-row items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <MaterialIcons
                key={star}
                name={star <= Math.floor(rating) ? "star" : "star-border"}
                size={18}
                color="#f59e0b"
              />
            ))}
          </View>
          <Text className="text-base font-bold text-[#1b1f29] dark:text-[#f3f5ff]">
            {rating.toFixed(1)} / 5
          </Text>
          <Text className="ml-2 text-xs text-[#7d8699] dark:text-[#8f97b5]">({reviewCount} reviews)</Text>
        </View>

        <View className="flex-row flex-wrap justify-between">
          <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
              Completed trades
            </Text>
            <Text className="mt-1 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{completedTrades}</Text>
          </View>
          <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
            <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Avg response</Text>
            <Text className="mt-1 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{responseTime}</Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-3">
          <View className="flex-row items-center">
            <MaterialIcons name="verified-user" size={16} color="#2563eb" />
            <Text className="ml-2 text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">KYC Verified</Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="shield" size={16} color="#16a34a" />
            <Text className="ml-2 text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Escrow Compatible</Text>
          </View>
        </View>
      </View>

      <View className="flex-row gap-2">
        <Pressable className="flex-1 flex-row items-center justify-center rounded-xl bg-[#4b6bfb] px-4 py-3">
          <MaterialIcons name="shopping-bag" size={16} color="#fff" />
          <Text className="ml-2 text-sm font-semibold text-white">Buy Listing</Text>
        </Pressable>
        <Pressable className="flex-1 flex-row items-center justify-center rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-3">
          <MaterialIcons name="chat-bubble-outline" size={16} color="#1b1f29" />
          <Text className="ml-2 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Message Seller</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
