import React, { useEffect, useMemo, useState } from "react";
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
import { PublicKey } from "@solana/web3.js";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { parseAmountToU64 } from "../../lib/tokenAmount";
import { createListingTransaction } from "../../lib/escrow";
import { getWalletPublicKey } from "../../lib/wallet";
import { recordListingActivity } from "../../lib/activity";
import { useWalletTokens } from "../../hooks/useWalletTokens";
import { useBackendAuth } from "../../contexts/BackendAuthContext";

type ListingUnit = "percentage" | "token_amount";
type PricingMode = "manual" | "auto";

type WalletToken = {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
};

const quoteDecimals = 6;
const INPUT_EPSILON = 1e-9;

const Create = () => {
  const { account, connection, signAndSendTransaction } = useMobileWallet();
  const { ensureAuth } = useBackendAuth();
  const { tokens: walletTokens, loading: tokensLoading } = useWalletTokens();

  const [step, setStep] = useState<1 | 2>(1);
  const [tokenMint, setTokenMint] = useState("");
  const [listingUnit, setListingUnit] = useState<ListingUnit>("percentage");
  const [listedValue, setListedValue] = useState("5");
  const [pricingMode, setPricingMode] = useState<PricingMode>("manual");
  const [pricePerToken, setPricePerToken] = useState("0.042");
  const [minPurchase, setMinPurchase] = useState("100");
  const [allowPartial, setAllowPartial] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successSignature, setSuccessSignature] = useState<string | null>(null);

  const walletPublicKey = useMemo(
    () => getWalletPublicKey(account ?? null),
    [account]
  );

  useEffect(() => {
    if (walletTokens.length === 0) {
      setTokenMint("");
      return;
    }
    setTokenMint((prev) => (prev && walletTokens.some((item) => item.mint === prev) ? prev : walletTokens[0].mint));
  }, [walletTokens]);

  const selectedToken = useMemo(
    () => walletTokens.find((t) => t.mint === tokenMint) ?? null,
    [tokenMint, walletTokens]
  );

  const tokenAmount = useMemo(() => {
    if (!selectedToken) return 0;
    const value = Math.max(0, Number(listedValue) || 0);
    if (listingUnit === "percentage") {
      const clampedPercent = Math.min(100, value);
      return (clampedPercent / 100) * selectedToken.balance;
    }
    return Math.min(value, selectedToken.balance);
  }, [listedValue, listingUnit, selectedToken]);

  const totalValue = useMemo(() => {
    return tokenAmount * (Number(pricePerToken) || 0);
  }, [tokenAmount, pricePerToken]);
  const formatUsd = (value: number) =>
    `$${value.toLocaleString(undefined, {
      minimumFractionDigits: value > 0 && value < 0.01 ? 6 : 2,
      maximumFractionDigits: value > 0 && value < 0.01 ? 8 : 2,
    })}`;

  const handleListedValueChange = (text: string) => {
    if (text.trim() === "") {
      setListedValue("");
      return;
    }
    if (!/^\d*\.?\d*$/.test(text)) return;

    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return;

    const maxAllowed = listingUnit === "percentage" ? 100 : selectedToken?.balance ?? 0;
    const clamped = Math.min(Math.max(parsed, 0), maxAllowed);
    setListedValue(clamped.toString());
  };

  const handleMinPurchaseChange = (text: string) => {
    if (text.trim() === "") {
      setMinPurchase("");
      return;
    }
    if (!/^\d*\.?\d*$/.test(text)) return;

    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return;

    const clamped = Math.min(Math.max(parsed, 0), tokenAmount);
    setMinPurchase(clamped.toString());
  };

  useEffect(() => {
    if (!selectedToken) return;
    const numericListed = Number(listedValue);
    if (!Number.isFinite(numericListed)) return;

    if (listingUnit === "percentage" && numericListed > 100 + INPUT_EPSILON) {
      setListedValue("100");
      return;
    }
    if (listingUnit === "token_amount" && numericListed > selectedToken.balance + INPUT_EPSILON) {
      setListedValue(selectedToken.balance.toString());
    }
  }, [listedValue, listingUnit, selectedToken]);

  useEffect(() => {
    if (!allowPartial) return;
    const numericMin = Number(minPurchase);
    if (!Number.isFinite(numericMin)) return;
    if (numericMin > tokenAmount + INPUT_EPSILON) {
      setMinPurchase(Math.max(0, tokenAmount).toString());
    }
  }, [allowPartial, minPurchase, tokenAmount]);

  const goReview = () => {
    setCreateError(null);
    setSuccessSignature(null);
    if (!selectedToken) {
      setCreateError("No wallet token available to list. Fund an SPL token first.");
      return;
    }
    if (tokenAmount <= 0) {
      setCreateError("Listing amount must be greater than zero.");
      return;
    }
    if (selectedToken && tokenAmount - selectedToken.balance > INPUT_EPSILON) {
      setCreateError("Tokens to sell cannot exceed your wallet balance.");
      return;
    }
    if (Number(pricePerToken) <= 0) {
      setCreateError("Price per token must be greater than zero.");
      return;
    }
    if (allowPartial && Number(minPurchase) <= 0) {
      setCreateError("Minimum purchase must be greater than zero.");
      return;
    }
    if (allowPartial && Number(minPurchase) - tokenAmount > INPUT_EPSILON) {
      setCreateError("Minimum purchase cannot exceed tokens to sell.");
      return;
    }
    setStep(2);
  };

  const goBack = () => setStep(1);

  const handleCreateListing = async () => {
    if (creating) return;
    setCreateError(null);
    setSuccessSignature(null);

    if (!walletPublicKey) {
      setCreateError("Connect wallet to create listing.");
      return;
    }
    if (!selectedToken) {
      setCreateError("No token selected.");
      return;
    }

    const numericPrice = Number(pricePerToken);
    const numericTokenAmount = tokenAmount;
    const numericMinPurchase = allowPartial
      ? Math.min(Number(minPurchase) || 0, numericTokenAmount)
      : numericTokenAmount;

    if (numericPrice <= 0 || numericTokenAmount <= 0 || numericMinPurchase <= 0) {
      setCreateError("Invalid listing values. Check amount, price, and min purchase.");
      return;
    }

    try {
      setCreating(true);

      const result = await createListingTransaction({
        connection,
        owner: walletPublicKey,
        signAndSendTransaction,
        baseMint: new PublicKey(selectedToken.mint),
        pricePerTokenRaw: parseAmountToU64(pricePerToken, quoteDecimals),
        quantityRaw: parseAmountToU64(
          numericTokenAmount.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: selectedToken.decimals }),
          selectedToken.decimals
        ),
        minBuyAmountRaw: parseAmountToU64(
          numericMinPurchase.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: selectedToken.decimals }),
          selectedToken.decimals
        ),
        allowPartial,
      });

      setSuccessSignature(result.signature);

      // Record backend activity like frontend flow.
      try {
        const token = await ensureAuth();
        if (!token) throw new Error("Missing backend auth token");
        await recordListingActivity({
          token,
          listingAddress: result.listingPubkey.toBase58(),
          txHash: result.signature,
          type: "CREATE",
          occurredAt: new Date().toISOString(),
        });
      } catch (activityError) {
        console.debug("Failed to record listing activity", activityError);
      }
    } catch (error) {
      console.error("Create listing failed", error);
      setCreateError(error instanceof Error ? error.message : "Failed to create listing.");
    } finally {
      setCreating(false);
    }
  };

  const walletConnected = !!walletPublicKey;

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

          {!!createError ? (
            <View className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <Text className="text-xs text-red-700 dark:text-red-300">{createError}</Text>
            </View>
          ) : null}
          {!!successSignature ? (
            <View className="mb-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3">
              <Text className="text-xs font-semibold text-green-700 dark:text-green-300">Listing created on-chain.</Text>
              <Text className="mt-1 text-[10px] text-green-700 dark:text-green-300">Tx: {successSignature}</Text>
            </View>
          ) : null}

          {step === 1 ? (
            <View className="gap-4">
              <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-[1.4px] text-[#7d8699] dark:text-[#8f97b5]">
                    Wallet tokens
                  </Text>
                  <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">
                    {tokensLoading ? "Loading..." : `${walletTokens.length} available`}
                  </Text>
                </View>

                {!walletConnected ? (
                  <View className="rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-3">
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Connect wallet to load tokens.</Text>
                  </View>
                ) : null}

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
                          Balance: {token.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
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
                    value={selectedToken?.mint ?? "No token selected"}
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
                    onChangeText={handleListedValueChange}
                    keyboardType="numeric"
                    className="h-12 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                  />
                  <Text className="mt-1 text-xs text-[#7d8699] dark:text-[#8f97b5]">
                    {listingUnit === "percentage"
                      ? "Max 100%"
                      : `Max available: ${(selectedToken?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}`}
                  </Text>
                </View>

                <View className="rounded-2xl border border-[#4b6bfb]/40 bg-[#4b6bfb]/10 px-4 py-3">
                  <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Calculated token amount</Text>
                  <Text className="mt-1 text-lg font-bold text-[#4b6bfb]">
                    {tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens
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
                  onChangeText={handleMinPurchaseChange}
                  keyboardType="numeric"
                  editable={allowPartial}
                  className={`h-12 rounded-xl border px-4 text-sm text-[#1b1f29] dark:text-[#f3f5ff] ${
                    allowPartial ? "border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27]" : "border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
                  }`}
                />
                {allowPartial ? (
                  <Text className="mt-1 text-xs text-[#7d8699] dark:text-[#8f97b5]">
                    Max min purchase: {tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens
                  </Text>
                ) : null}
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
                    {selectedToken ? `$${selectedToken.symbol} · ${selectedToken.name}` : "No token"}
                  </Text>
                </View>
                <View className="mt-3 flex-row gap-2">
                  <View className="flex-1 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-3">
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Listing amount</Text>
                    <Text className="text-base font-semibold text-[#4b6bfb]">
                      {tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-3">
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Min. fill</Text>
                    <Text className="text-base font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      {allowPartial ? Math.min(Number(minPurchase) || 0, tokenAmount) : tokenAmount}
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
                    -{formatUsd(totalValue * 0.01)}
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
                  onPress={handleCreateListing}
                  disabled={creating || !walletConnected || !selectedToken}
                  className="h-12 flex-1 items-center justify-center rounded-xl bg-[#4b6bfb] disabled:opacity-50"
                >
                  <Text className="text-sm font-semibold text-white">
                    {creating ? "Creating..." : walletConnected ? "Create Listing" : "Connect Wallet"}
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
