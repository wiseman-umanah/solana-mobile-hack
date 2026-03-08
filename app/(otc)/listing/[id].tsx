import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { PublicKey } from "@solana/web3.js";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import * as Clipboard from "expo-clipboard";
import { useListings } from "../../../hooks/useListings";
import { getWalletPublicKey } from "../../../lib/wallet";
import { parseAmountToU64 } from "../../../lib/tokenAmount";
import { cancelListingTransaction, purchaseListingTransaction } from "../../../lib/escrow";
import { DEFAULT_QUOTE_MINT } from "../../../lib/solanaConfig";
import { useBackendAuth } from "../../../contexts/BackendAuthContext";
import { recordListingActivity } from "../../../lib/activity";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ReviewItem = {
  id: string;
  reviewer: string;
  rating: number;
  comment: string;
  createdAt: string;
};

const EPSILON = 1e-9;

function formatUsd(value: number) {
  const abs = Math.abs(value);
  const decimals = abs > 0 && abs < 1 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatToken(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function ListingDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { account, connect, connection, signAndSendTransaction } = useMobileWallet();
  const { ensureAuth } = useBackendAuth();
  const insets = useSafeAreaInsets();
  const { listings, loading, refresh } = useListings();
  const walletPublicKey = useMemo(() => getWalletPublicKey(account ?? null), [account]);
  const walletAddress = walletPublicKey?.toBase58() ?? null;

  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [idCopied, setIdCopied] = useState(false);

  const listing = useMemo(
    () => listings.find((item) => item.address === params.id || item.listingId === params.id),
    [listings, params.id]
  );

  const isSeller = !!(listing && walletAddress && listing.sellerAddress === walletAddress);
  const canCancel = !!(listing && isSeller && listing.status === "ACTIVE");
  const canBuy = !!(listing && !isSeller && listing.status === "ACTIVE" && listing.remainingUi > 0);

  const ratingAverage = useMemo(() => {
    if (reviews.length === 0) return null;
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [reviews]);

  const progress = listing && listing.quantityUi > 0 ? (listing.filledUi / listing.quantityUi) * 100 : 0;
  const remainingValue = listing ? listing.remainingUi * listing.priceUi : 0;

  const quantityNumber = Number(purchaseAmount || "0");
  const totalCost = listing ? quantityNumber * listing.priceUi : 0;
  const feeEstimate = totalCost * 0.01;

  const maybeConnectWallet = async () => {
    if (walletPublicKey) return true;
    try {
      await connect();
      return true;
    } catch (error) {
      console.error("Wallet connect failed", error);
      setSubmitError("Connect wallet to continue.");
      return false;
    }
  };

  const validatePurchaseAmount = () => {
    if (!listing) return "Listing unavailable.";
    const sanitized = purchaseAmount.trim();
    if (!sanitized) return "Enter a quantity to purchase.";
    if (!/^\d+(\.\d+)?$/.test(sanitized)) return "Enter a numeric quantity.";

    const quantity = Number(sanitized);
    if (!Number.isFinite(quantity) || quantity <= 0) return "Quantity must be greater than zero.";
    if (quantity - listing.remainingUi > EPSILON) return "Quantity exceeds remaining tokens.";

    if (listing.remainingUi - listing.minPurchaseUi > EPSILON && quantity + EPSILON < listing.minPurchaseUi) {
      return `Minimum order is ${formatToken(listing.minPurchaseUi)} ${listing.baseSymbol}.`;
    }

    if (
      listing.remainingUi <= listing.minPurchaseUi + EPSILON &&
      Math.abs(quantity - listing.remainingUi) > EPSILON
    ) {
      return `Only ${formatToken(listing.remainingUi)} ${listing.baseSymbol} remain. Buy the full remainder.`;
    }

    return null;
  };

  const handleBuy = async () => {
    if (!listing) return;
    setSubmitSuccess(null);
    setSubmitError(null);

    const connected = await maybeConnectWallet();
    if (!connected) return;
    if (!walletPublicKey) return;

    const validationError = validatePurchaseAmount();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    try {
      setIsPurchasing(true);
      const quantityRaw = parseAmountToU64(purchaseAmount.trim(), listing.baseDecimals);
      const { signature } = await purchaseListingTransaction({
        connection,
        buyer: walletPublicKey,
        signAndSendTransaction,
        listingAddress: new PublicKey(listing.address),
        seller: new PublicKey(listing.sellerAddress),
        baseMint: new PublicKey(listing.baseMint),
        quoteMint: DEFAULT_QUOTE_MINT,
        quantityRaw,
        listingId: BigInt(listing.listingId),
      });

      try {
        const token = await ensureAuth();
        if (token) {
          await recordListingActivity({
            token,
            listingAddress: listing.address,
            txHash: signature,
            type: "PURCHASE",
            occurredAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.debug("Failed to record purchase activity", error);
      }

      setPurchaseAmount("");
      setIsBuyModalOpen(false);
      setSubmitSuccess("Purchase submitted. Check wallet for confirmation.");
      await refresh();
    } catch (error) {
      console.error("Purchase failed", error);
      setSubmitError(error instanceof Error ? error.message : "Purchase failed.");
    } finally {
      setIsPurchasing(false);
    }
  };

  const handlePurchaseAmountChange = (text: string) => {
    const normalized = text.trim();
    if (!listing) return;
    if (normalized === "") {
      setPurchaseAmount("");
      return;
    }
    if (!/^\d*\.?\d*$/.test(normalized)) {
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = Math.max(0, Math.min(parsed, listing.remainingUi));
    setPurchaseAmount(clamped.toString());
  };

  const handleCancel = async () => {
    if (!listing || !walletPublicKey || !canCancel) return;
    setCancelError(null);
    setSubmitSuccess(null);

    try {
      setIsCancelling(true);
      const { signature } = await cancelListingTransaction({
        connection,
        seller: walletPublicKey,
        signAndSendTransaction,
        listingAddress: new PublicKey(listing.address),
        baseMint: new PublicKey(listing.baseMint),
        listingId: BigInt(listing.listingId),
      });

      try {
        const token = await ensureAuth();
        if (token) {
          await recordListingActivity({
            token,
            listingAddress: listing.address,
            txHash: signature,
            type: "DISCOUNT_CANCELLED",
            occurredAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.debug("Failed to record cancel activity", error);
      }

      setSubmitSuccess("Listing cancelled.");
      await refresh();
    } catch (error) {
      console.error("Cancel listing failed", error);
      setCancelError(error instanceof Error ? error.message : "Failed to cancel listing.");
    } finally {
      setIsCancelling(false);
    }
  };

  const copyListingId = async () => {
    if (!listing) return;
    const text = `Listing ID #${listing.listingId}\nAddress: ${listing.address}`;
    await Clipboard.setStringAsync(text);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 1200);
  };

  const submitReview = () => {
    const comment = reviewComment.trim();
    if (!comment) return;
    const reviewer = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "Guest";
    const next: ReviewItem = {
      id: `${Date.now()}`,
      reviewer,
      rating: reviewRating,
      comment,
      createdAt: new Date().toISOString(),
    };
    setReviews((prev) => [next, ...prev]);
    setReviewComment("");
    setReviewRating(5);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f6f7fb] px-6 dark:bg-[#10131b]">
        <Text className="text-sm text-[#7d8699] dark:text-[#8f97b5]">Loading listing...</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f6f7fb] px-6 dark:bg-[#10131b]">
        <View className="rounded-3xl border border-[#e2e6f0] bg-white px-6 py-8 dark:border-[#30384c] dark:bg-[#181c27]">
          <Text className="text-center text-lg font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
            Listing Not Found
          </Text>
          <Pressable
            onPress={() => router.push("/(otc)/listing")}
            className="mt-4 rounded-xl bg-[#4b6bfb] px-4 py-3"
          >
            <Text className="text-center text-sm font-semibold text-white">Back to listings</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-[#f6f7fb] px-3 py-4 dark:bg-[#10131b]"
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <Pressable
          onPress={() => router.push("/(otc)/listing")}
          className="mb-3 self-start rounded-full border border-[#e2e6f0] bg-white px-3 py-2 dark:border-[#30384c] dark:bg-[#181c27]"
        >
          <View className="flex-row items-center">
            <MaterialIcons name="arrow-back" size={16} color="#1b1f29" />
            <Text className="ml-1 text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
              Back to listings
            </Text>
          </View>
        </Pressable>

        <View className="mb-4 rounded-3xl border border-[#e2e6f0] bg-white p-5 shadow-sm dark:border-[#30384c] dark:bg-[#181c27]">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-3xl font-bold text-[#1b1f29] dark:text-[#f3f5ff]">${listing.baseSymbol}</Text>
              <View className="mt-1 flex-row items-center">
                <Text className="text-sm text-[#7d8699] dark:text-[#8f97b5]">Listing ID #{listing.listingId}</Text>
                <Pressable
                  onPress={copyListingId}
                  className="ml-2 rounded-full border border-[#e2e6f0] px-2 py-1 dark:border-[#30384c]"
                >
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name={idCopied ? "check" : "content-copy"}
                      size={12}
                      color={idCopied ? "#16a34a" : "#4b6bfb"}
                    />
                    <Text
                      className={`ml-1 text-[10px] font-semibold uppercase tracking-[0.7px] ${
                        idCopied ? "text-green-600" : "text-[#4b6bfb]"
                      }`}
                    >
                      {idCopied ? "Copied" : "Copy"}
                    </Text>
                  </View>
                </Pressable>
              </View>
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
            {formatToken(listing.filledUi)} sold / {formatToken(listing.quantityUi)} total
          </Text>
        </View>

        <View className="mb-4 rounded-3xl border border-[#e2e6f0] bg-white p-5 shadow-sm dark:border-[#30384c] dark:bg-[#181c27]">
          <Text className="mb-3 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Listing stats</Text>
          <View className="flex-row flex-wrap justify-between">
            <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] bg-[#f1f3f8] px-3 py-3 dark:border-[#30384c] dark:bg-[#1f2431]">
              <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
                Price per token
              </Text>
              <Text className="mt-1 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                {formatUsd(listing.priceUi)}
              </Text>
            </View>
            <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] bg-[#f1f3f8] px-3 py-3 dark:border-[#30384c] dark:bg-[#1f2431]">
              <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
                Remaining tokens
              </Text>
              <Text className="mt-1 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                {formatToken(listing.remainingUi)}
              </Text>
            </View>
            <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] bg-[#f1f3f8] px-3 py-3 dark:border-[#30384c] dark:bg-[#1f2431]">
              <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
                Min. purchase
              </Text>
              <Text className="mt-1 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                {formatToken(Math.min(listing.minPurchaseUi, listing.remainingUi))}
              </Text>
            </View>
            <View className="mb-3 w-[48%] rounded-xl border border-[#e2e6f0] bg-[#f1f3f8] px-3 py-3 dark:border-[#30384c] dark:bg-[#1f2431]">
              <Text className="text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
                Value remaining
              </Text>
              <Text className="mt-1 text-sm font-semibold text-green-600">{formatUsd(remainingValue)}</Text>
            </View>
          </View>
        </View>

        <View className="mb-4 rounded-3xl border border-[#e2e6f0] bg-white p-5 shadow-sm dark:border-[#30384c] dark:bg-[#181c27]">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Reviews</Text>
            <Text className="text-xs uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
              {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              {ratingAverage ? ` · ${ratingAverage.toFixed(1)} ★` : ""}
            </Text>
          </View>

          <View className="mt-3 rounded-2xl border border-[#e2e6f0] bg-[#f1f3f8] p-3 dark:border-[#30384c] dark:bg-[#1f2431]">
            <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
              Rating
            </Text>
            <View className="mt-2 flex-row items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setReviewRating(star)} className="mr-1">
                  <MaterialIcons
                    name={star <= reviewRating ? "star" : "star-border"}
                    size={21}
                    color={star <= reviewRating ? "#f59e0b" : "#7d8699"}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Share your experience with this seller..."
              placeholderTextColor="#7d8699"
              multiline
              textAlignVertical="top"
              className="mt-3 min-h-[92px] rounded-xl border border-[#e2e6f0] bg-white px-3 py-3 text-sm text-[#1b1f29] dark:border-[#30384c] dark:bg-[#181c27] dark:text-[#f3f5ff]"
            />
            <View className="mt-3 items-end">
              <Pressable
                onPress={submitReview}
                disabled={!reviewComment.trim()}
                className={`rounded-full px-4 py-2 ${
                  reviewComment.trim() ? "bg-[#4b6bfb]" : "bg-[#9fb0fc]"
                }`}
              >
                <Text className="text-xs font-semibold text-white">Submit review</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-4">
            {reviews.length === 0 ? (
              <View className="rounded-2xl border border-dashed border-[#e2e6f0] bg-[#f1f3f8] px-4 py-6 dark:border-[#30384c] dark:bg-[#1f2431]">
                <Text className="text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">
                  No reviews yet. Be the first to leave feedback.
                </Text>
              </View>
            ) : (
              reviews.map((review) => (
                <View
                  key={review.id}
                  className="mb-3 rounded-2xl border border-[#e2e6f0] bg-[#f1f3f8] px-4 py-3 dark:border-[#30384c] dark:bg-[#1f2431]"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#4b6bfb]">
                      {review.reviewer}
                    </Text>
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View className="mt-1 flex-row items-center">
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <MaterialIcons key={`${review.id}-${index}`} name="star" size={14} color="#f59e0b" />
                    ))}
                  </View>
                  <Text className="mt-2 text-sm text-[#1b1f29] dark:text-[#f3f5ff]">{review.comment}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {cancelError ? (
          <View className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <Text className="text-xs text-red-700 dark:text-red-300">{cancelError}</Text>
          </View>
        ) : null}
        {submitError ? (
          <View className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <Text className="text-xs text-red-700 dark:text-red-300">{submitError}</Text>
          </View>
        ) : null}
        {submitSuccess ? (
          <View className="mb-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3">
            <Text className="text-xs text-green-700 dark:text-green-300">{submitSuccess}</Text>
          </View>
        ) : null}

        <View className="flex-row gap-2">
          {isSeller ? (
            <Pressable
              onPress={handleCancel}
              disabled={!canCancel || isCancelling}
              className={`flex-1 flex-row items-center justify-center rounded-xl px-4 py-3 ${
                canCancel ? "bg-red-500" : "bg-red-300"
              }`}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="cancel" size={16} color="#fff" />
              )}
              <Text className="ml-2 text-sm font-semibold text-white">
                {listing.status === "CANCELLED" ? "Listing cancelled" : "Cancel listing"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                setSubmitError(null);
                const initialAmount =
                  listing.remainingUi >= 1 ? "1" : Math.max(0, listing.remainingUi).toString();
                setPurchaseAmount(initialAmount);
                setIsBuyModalOpen(true);
              }}
              disabled={!canBuy}
              className={`flex-1 flex-row items-center justify-center rounded-xl px-4 py-3 ${
                canBuy ? "bg-[#4b6bfb]" : "bg-[#9fb0fc]"
              }`}
            >
              <MaterialIcons name="shopping-bag" size={16} color="#fff" />
              <Text className="ml-2 text-sm font-semibold text-white">Buy listing</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(otc)/message",
                params: { recipient: listing.sellerAddress },
              })
            }
            className="flex-1 flex-row items-center justify-center rounded-xl border border-[#e2e6f0] bg-white px-4 py-3 dark:border-[#30384c] dark:bg-[#181c27]"
          >
            <MaterialIcons name="chat-bubble-outline" size={16} color="#1b1f29" />
            <Text className="ml-2 text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
              Message seller
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={isBuyModalOpen} animationType="slide" transparent onRequestClose={() => setIsBuyModalOpen(false)}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={24}
        >
          <View className="flex-1 justify-end bg-black/30">
            <View
              className="rounded-t-3xl border border-[#e2e6f0] bg-white p-5 dark:border-[#30384c] dark:bg-[#181c27]"
              style={{ paddingBottom: Math.max(insets.bottom + 12, 24) }}
            >
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Purchase tokens</Text>
                <Pressable onPress={() => setIsBuyModalOpen(false)} className="rounded-full p-1">
                  <MaterialIcons name="close" size={20} color="#7d8699" />
                </Pressable>
              </View>

              <Text className="mb-1 text-xs font-semibold uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
                Amount to purchase
              </Text>
              <View className="flex-row items-center rounded-xl border border-[#e2e6f0] bg-[#f1f3f8] px-3 py-2 dark:border-[#30384c] dark:bg-[#1f2431]">
                <TextInput
                  value={purchaseAmount}
                  onChangeText={handlePurchaseAmountChange}
                  keyboardType="decimal-pad"
                  placeholder={`Min ${formatToken(Math.min(listing.minPurchaseUi, listing.remainingUi))}`}
                  placeholderTextColor="#7d8699"
                  className="h-10 flex-1 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                />
                <Pressable
                  onPress={() => setPurchaseAmount(listing.remainingUi.toString())}
                  className="rounded-lg bg-[#4b6bfb]/15 px-2 py-1"
                >
                  <Text className="text-xs font-semibold text-[#4b6bfb]">Max</Text>
                </Pressable>
              </View>

              <Text className="mt-2 text-xs text-[#7d8699] dark:text-[#8f97b5]">
                Remaining: {formatToken(listing.remainingUi)} {listing.baseSymbol}
              </Text>
              <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">
                Minimum per fill: {formatToken(Math.min(listing.minPurchaseUi, listing.remainingUi))} {listing.baseSymbol}
              </Text>

              <View className="mt-4 rounded-2xl border border-[#e2e6f0] bg-[#f1f3f8] p-3 dark:border-[#30384c] dark:bg-[#1f2431]">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-[#1b1f29] dark:text-[#f3f5ff]">Total cost</Text>
                  <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{formatUsd(totalCost)}</Text>
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Platform fee (1%)</Text>
                  <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">{formatUsd(feeEstimate)}</Text>
                </View>
              </View>

              <Pressable
                onPress={handleBuy}
                disabled={isPurchasing}
                className={`mt-4 items-center justify-center rounded-full px-4 py-3 ${
                  isPurchasing ? "bg-[#9fb0fc]" : "bg-[#4b6bfb]"
                }`}
              >
                {isPurchasing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-sm font-semibold text-white">Confirm purchase</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
