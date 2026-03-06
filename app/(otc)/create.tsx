import React, { useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type ListingUnit = "percentage" | "token_amount";
type PricingMode = "manual" | "auto";

const walletTokens = [
  { mint: "7Yk...v9Hg", symbol: "BONK", name: "Bonk", balance: 1250000, decimals: 5 },
  { mint: "9Ld...a31Q", symbol: "JUP", name: "Jupiter", balance: 84200, decimals: 6 },
  { mint: "4Np...y2Et", symbol: "PYTH", name: "Pyth", balance: 23450, decimals: 6 },
];

const Create = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [tokenMint, setTokenMint] = useState(walletTokens[0].mint);
  const [listingUnit, setListingUnit] = useState<ListingUnit>("percentage");
  const [listedValue, setListedValue] = useState("5");
  const [pricingMode, setPricingMode] = useState<PricingMode>("manual");
  const [pricePerToken, setPricePerToken] = useState("0.042");
  const [minPurchase, setMinPurchase] = useState("100");
  const [allowPartial, setAllowPartial] = useState(true);
  const [creating, setCreating] = useState(false);

  const selectedToken = useMemo(
    () => walletTokens.find((t) => t.mint === tokenMint) ?? walletTokens[0],
    [tokenMint]
  );

  const tokenAmount = useMemo(() => {
    const value = Number(listedValue) || 0;
    if (listingUnit === "percentage") return (value / 100) * selectedToken.balance;
    return value;
  }, [listedValue, listingUnit, selectedToken.balance]);

  const totalValue = useMemo(() => {
    return tokenAmount * (Number(pricePerToken) || 0);
  }, [tokenAmount, pricePerToken]);

  const goReview = () => setStep(2);
  const goBack = () => setStep(1);

  const simulateCreate = () => {
    if (creating) return;
    setCreating(true);
    setTimeout(() => setCreating(false), 900);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={8}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          className="flex-1 bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-4"
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
      <View className="mb-4 rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="mb-4 flex-row items-start justify-between">
          {step === 2 ? (
            <Pressable
              onPress={goBack}
              className="h-11 w-11 items-center justify-center rounded-full border border-[#e2e6f0] dark:border-[#30384c]"
            >
              <MaterialIcons name="arrow-back" size={20} color="#1b1f29" />
            </Pressable>
          ) : (
            <View className="h-11 w-11" />
          )}
          <View className="ml-3 flex-1">
            <View className="self-start rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-1">
              <Text className="text-[10px] font-semibold uppercase tracking-[1.8px] text-[#7d8699] dark:text-[#8f97b5]">
                Create Listing
              </Text>
            </View>
            <Text className="mt-3 text-2xl font-bold text-[#1b1f29] dark:text-[#f3f5ff]">
              Launch an OTC listing in minutes
            </Text>
            <Text className="mt-1 text-sm text-[#7d8699] dark:text-[#8f97b5]">
              Configure token details, pricing, and review before publishing.
            </Text>
          </View>
        </View>

        <View className="mb-2 flex-row items-center justify-center">
          {[1, 2].map((item, index) => {
            const active = step >= item;
            return (
              <View key={item} className="flex-row items-center">
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full border ${
                    active ? "border-[#4b6bfb] bg-[#4b6bfb]/15" : "border-[#e2e6f0] dark:border-[#30384c]"
                  }`}
                >
                  <Text className={`text-xs font-semibold ${active ? "text-[#4b6bfb]" : "text-[#7d8699] dark:text-[#8f97b5]"}`}>
                    {item}
                  </Text>
                </View>
                {index === 0 ? <View className="mx-2 h-px w-10 bg-[#e2e6f0]" /> : null}
              </View>
            );
          })}
          <Text className="ml-3 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">{`Step ${step} of 2`}</Text>
        </View>
      </View>

      {step === 1 ? (
        <View className="gap-4">
          <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-[1.4px] text-[#7d8699] dark:text-[#8f97b5]">
                Wallet tokens
              </Text>
              <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">{walletTokens.length} available</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {walletTokens.map((token) => {
                const selected = token.mint === tokenMint;
                return (
                  <Pressable
                    key={token.mint}
                    onPress={() => setTokenMint(token.mint)}
                    className={`mr-3 min-w-[220px] rounded-2xl border px-4 py-3 ${
                      selected
                        ? "border-[#4b6bfb] bg-[#4b6bfb]/10"
                        : "border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
                    }`}
                  >
                    <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      ${token.symbol} · {token.name}
                    </Text>
                    <Text className="mt-1 text-xs text-[#7d8699] dark:text-[#8f97b5]">
                      Balance: {token.balance.toLocaleString()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
            <Text className="mb-3 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Listing details</Text>

            <View className="mb-3">
              <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Contract address</Text>
              <TextInput
                editable={false}
                value={selectedToken.mint}
                className="h-12 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
              />
            </View>

            <View className="mb-3">
              <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Listing unit</Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setListingUnit("percentage")}
                  className={`flex-1 rounded-xl border px-3 py-3 ${
                    listingUnit === "percentage"
                      ? "border-[#4b6bfb] bg-[#4b6bfb]/10"
                      : "border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
                  }`}
                >
                  <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Percentage</Text>
                </Pressable>
                <Pressable
                  onPress={() => setListingUnit("token_amount")}
                  className={`flex-1 rounded-xl border px-3 py-3 ${
                    listingUnit === "token_amount"
                      ? "border-[#4b6bfb] bg-[#4b6bfb]/10"
                      : "border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
                  }`}
                >
                  <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Token amount</Text>
                </Pressable>
              </View>
            </View>

            <View className="mb-3">
              <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">
                {listingUnit === "percentage" ? "Percentage to sell (%)" : "Tokens to sell"}
              </Text>
              <TextInput
                value={listedValue}
                onChangeText={setListedValue}
                keyboardType="numeric"
                className="h-12 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
              />
            </View>

            <View className="rounded-2xl border border-[#4b6bfb]/40 bg-[#4b6bfb]/10 px-4 py-3">
              <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Calculated token amount</Text>
              <Text className="mt-1 text-lg font-bold text-[#4b6bfb]">
                {tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} tokens
              </Text>
            </View>
          </View>

          <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
            <Text className="mb-3 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Pricing</Text>

            <View className="mb-3 flex-row gap-2">
              <Pressable
                onPress={() => setPricingMode("manual")}
                className={`flex-1 rounded-xl border px-3 py-3 ${
                  pricingMode === "manual"
                    ? "border-[#4b6bfb] bg-[#4b6bfb]/10"
                    : "border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
                }`}
              >
                <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Manual price</Text>
              </Pressable>
              <Pressable
                onPress={() => setPricingMode("auto")}
                className={`flex-1 rounded-xl border px-3 py-3 ${
                  pricingMode === "auto"
                    ? "border-[#4b6bfb] bg-[#4b6bfb]/10"
                    : "border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
                }`}
              >
                <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Market-aware</Text>
              </Pressable>
            </View>

            <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Price per token (USDC)</Text>
            <TextInput
              value={pricePerToken}
              onChangeText={setPricePerToken}
              keyboardType="numeric"
              editable={pricingMode === "manual"}
              className={`h-12 rounded-xl border px-4 text-sm text-[#1b1f29] dark:text-[#f3f5ff] ${
                pricingMode === "manual"
                  ? "border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27]"
                  : "border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
              }`}
            />

            <View className="mt-3 flex-row items-center justify-between rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-3">
              <Text className="text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Allow partial fills</Text>
              <Switch value={allowPartial} onValueChange={setAllowPartial} trackColor={{ true: "#93c5fd" }} />
            </View>

            <Text className="mb-1 mt-3 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Minimum purchase (tokens)</Text>
            <TextInput
              value={minPurchase}
              onChangeText={setMinPurchase}
              keyboardType="numeric"
              editable={allowPartial}
              className={`h-12 rounded-xl border px-4 text-sm text-[#1b1f29] dark:text-[#f3f5ff] ${
                allowPartial ? "border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27]" : "border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
              }`}
            />
          </View>

          <Pressable onPress={goReview} className="h-12 items-center justify-center rounded-xl bg-[#4b6bfb]">
            <Text className="text-sm font-semibold text-white">Continue to Preview</Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-4">
          <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
            <View className="items-center">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#4b6bfb]">
                <MaterialIcons name="shield" size={26} color="#fff" />
              </View>
              <Text className="mt-3 text-2xl font-bold text-[#1b1f29] dark:text-[#f3f5ff]">Review your listing</Text>
              <Text className="mt-1 text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">
                Double-check token details, pricing, and buyer terms.
              </Text>
            </View>
          </View>

          <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
            <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Token summary</Text>
            <View className="mt-3 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-3">
              <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Token</Text>
              <Text className="text-base font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                ${selectedToken.symbol} · {selectedToken.name}
              </Text>
            </View>
            <View className="mt-3 flex-row gap-2">
              <View className="flex-1 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-3">
                <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Listing amount</Text>
                <Text className="text-base font-semibold text-[#4b6bfb]">
                  {tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </Text>
              </View>
              <View className="flex-1 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-3">
                <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Min. fill</Text>
                <Text className="text-base font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                  {allowPartial ? minPurchase : tokenAmount}
                </Text>
              </View>
            </View>
          </View>

          <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
            <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Pricing & fees</Text>
            <View className="mt-3 flex-row items-center justify-between">
              <Text className="text-sm text-[#7d8699] dark:text-[#8f97b5]">Price per token</Text>
              <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">${pricePerToken} USDC</Text>
            </View>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-sm text-[#7d8699] dark:text-[#8f97b5]">Total listing value</Text>
              <Text className="text-sm font-semibold text-[#4b6bfb]">
                ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View className="mt-3 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-3">
              <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Platform fee (1%)</Text>
              <Text className="text-sm font-semibold text-[#b91c1c]">
                -${(totalValue * 0.01).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={goBack}
              className="h-12 flex-1 items-center justify-center rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27]"
            >
              <Text className="text-sm font-semibold text-[#7d8699] dark:text-[#8f97b5]">Back</Text>
            </Pressable>
            <Pressable
              onPress={simulateCreate}
              className="h-12 flex-1 items-center justify-center rounded-xl bg-[#4b6bfb]"
            >
              <Text className="text-sm font-semibold text-white">
                {creating ? "Creating..." : "Create Listing"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default Create;
