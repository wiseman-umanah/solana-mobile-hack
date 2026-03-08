import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { PublicKey } from "@solana/web3.js";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { io, Socket } from "socket.io-client";
import { useBackendAuth } from "../../../contexts/BackendAuthContext";
import { getBackendBaseUrl } from "../../../lib/backendAuth";
import { getWalletPublicKey } from "../../../lib/wallet";
import { useListings } from "../../../hooks/useListings";
import { parseAmountToU64 } from "../../../lib/tokenAmount";
import {
  cancelOfferTransaction,
  createOfferTransaction,
  EnrichedOffer,
  getOfferById,
  payOfferTransaction,
} from "../../../lib/escrow";
import { recordListingActivity } from "../../../lib/activity";

type PricingStep = "identify" | "configure";
type OfferModalRole = "owner" | "buyer";

type ApiMessage = {
  _id?: string;
  sender: string;
  receiver: string;
  message: string;
  tempId?: string;
  offering_id?: string | null;
  delivered?: boolean;
  read?: boolean;
  timestamp?: string;
};

const PRICE_DECIMALS = 6;

const formatAmount = (value: bigint, decimals: number) => Number(value) / 10 ** Math.max(0, decimals);
const shortAddress = (value: string) => (value.length > 10 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value);

export default function MessageThreadScreen() {
  const params = useLocalSearchParams<{ peer?: string }>();
  const { account, connection, signAndSendTransaction } = useMobileWallet();
  const { ensureAuth } = useBackendAuth();
  const { listings } = useListings();

  const walletAddress = useMemo(() => getWalletPublicKey(account ?? null)?.toBase58() ?? null, [account]);
  const walletPublicKey = useMemo(() => getWalletPublicKey(account ?? null), [account]);
  const peer = (params.peer ?? "").trim();
  const peerLabel = peer ? shortAddress(peer) : "Unknown";

  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingStep, setPricingStep] = useState<PricingStep>("identify");
  const [pricingListingId, setPricingListingId] = useState("");
  const [pricingPrice, setPricingPrice] = useState("1.05");
  const [pricingQuantity, setPricingQuantity] = useState("5000");
  const [pricingNote, setPricingNote] = useState("");
  const [pricingInstallmental, setPricingInstallmental] = useState(true);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifiedListing, setVerifiedListing] = useState<(typeof listings)[number] | null>(null);
  const [sharingOffer, setSharingOffer] = useState(false);

  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [offerModalRole, setOfferModalRole] = useState<OfferModalRole | null>(null);
  const [offerModalOfferId, setOfferModalOfferId] = useState<string | null>(null);
  const [offerDetails, setOfferDetails] = useState<EnrichedOffer | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerActionLoading, setOfferActionLoading] = useState(false);
  const [offerActionError, setOfferActionError] = useState<string | null>(null);
  const [buyerAmountInput, setBuyerAmountInput] = useState("");
  const [buyerAmountError, setBuyerAmountError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!peer) return;
    setLoading(true);
    setError(null);
    try {
      const token = await ensureAuth();
      if (!token) return;
      const res = await fetch(`${getBackendBaseUrl()}/api/messages?peer=${encodeURIComponent(peer)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load messages (${res.status})`);
      const payload = await res.json();
      const next: ApiMessage[] = payload?.messages ?? [];
      setMessages(next);

      const unreadInbound = next.some((item) => item.sender === peer && item.receiver === walletAddress && !item.read);
      if (unreadInbound) {
        await fetch(`${getBackendBaseUrl()}/api/messages/read`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ peer }),
        }).catch(() => null);
      }
    } catch (thrown) {
      console.error("Failed to fetch thread messages", thrown);
      setError("Unable to load this conversation right now.");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [peer, walletAddress, ensureAuth]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    let mounted = true;
    let socket: Socket | null = null;

    const connectSocket = async () => {
      if (!peer) return;
      const token = await ensureAuth();
      if (!token || !mounted) return;

      socket = io(getBackendBaseUrl(), {
        auth: { token },
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      socket.on("newMessage", (messageData: ApiMessage) => {
        if (!walletAddress) return;
        const relevant =
          (messageData.sender === peer && messageData.receiver === walletAddress) ||
          (messageData.sender === walletAddress && messageData.receiver === peer);
        if (!relevant) return;

        setMessages((prev) => {
          const exists = prev.some((item) => item._id && item._id === messageData._id);
          if (exists) return prev;
          return [...prev, messageData];
        });

        if (messageData.sender === peer && messageData._id) {
          socket?.emit("messageRead", { messageIds: [messageData._id] });
        }
      });

      socket.on("messageSent", (saved: ApiMessage) => {
        if (!saved?.tempId) return;
        setMessages((prev) =>
          prev.map((item) => (item.tempId && item.tempId === saved.tempId ? saved : item))
        );
      });

      socket.on("messageDelivered", (payload: { messageId?: string }) => {
        if (!payload?.messageId) return;
        setMessages((prev) =>
          prev.map((item) =>
            item._id && item._id.toString() === payload.messageId ? { ...item, delivered: true } : item
          )
        );
      });

      socket.on("messageRead", (payload: { messageId?: string }) => {
        if (!payload?.messageId) return;
        setMessages((prev) =>
          prev.map((item) =>
            item._id && item._id.toString() === payload.messageId ? { ...item, read: true } : item
          )
        );
      });
    };

    void connectSocket();
    return () => {
      mounted = false;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [peer, walletAddress, ensureAuth]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  };

  const sendMessage = async (messageText?: string, offerId?: string) => {
    const text = (messageText ?? draft).trim();
    if (!text || !peer || sending) return;

    const optimisticId = `temp-${Date.now()}`;
    const optimistic: ApiMessage = {
      _id: optimisticId,
      sender: walletAddress ?? "me",
      receiver: peer,
      message: text,
      offering_id: offerId ?? null,
      delivered: false,
      read: false,
      timestamp: new Date().toISOString(),
      tempId: optimisticId,
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const token = await ensureAuth();
      if (!token) throw new Error("Wallet authentication is required");

      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit("sendMessage", {
          receiver: peer,
          message: text,
          tempId: optimisticId,
          offering_id: offerId ?? null,
        });
      } else {
        const res = await fetch(`${getBackendBaseUrl()}/api/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            receiver: peer,
            message: text,
            tempId: optimisticId,
            offering_id: offerId ?? null,
          }),
        });
        if (!res.ok) throw new Error(`Failed to send message (${res.status})`);
        const payload = await res.json();
        const saved = payload?.message as ApiMessage | undefined;
        if (!saved) throw new Error("Server returned invalid message");
        setMessages((prev) => prev.map((item) => (item._id === optimisticId ? saved : item)));
      }
    } catch (thrown) {
      console.error("Failed to send message", thrown);
      setError("Message failed to send.");
      setMessages((prev) => prev.filter((item) => item._id !== optimisticId));
      if (!messageText) setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const verifyListingForPricing = async () => {
    setVerifying(true);
    setPricingError(null);
    setVerifiedListing(null);
    try {
      const input = pricingListingId.trim();
      if (!input) throw new Error("Enter a listing ID or listing address.");

      const listing = listings.find((item) => item.listingId === input || item.address === input);
      if (!listing) throw new Error("Listing not found.");
      if (!walletAddress || listing.sellerAddress !== walletAddress) {
        throw new Error("Only your own listing can be used for a discount offer.");
      }
      if (listing.status !== "ACTIVE" || listing.remainingUi <= 0) {
        throw new Error("Listing is not active or has no remaining tokens.");
      }

      setVerifiedListing(listing);
      setPricingPrice(listing.priceUi.toString());
      setPricingQuantity(listing.remainingUi.toString());
      setPricingStep("configure");
    } catch (thrown) {
      setPricingError(thrown instanceof Error ? thrown.message : "Could not verify listing.");
    } finally {
      setVerifying(false);
    }
  };

  const shareOffer = async () => {
    if (!verifiedListing) {
      setPricingError("Verify a listing before sharing terms.");
      return;
    }
    if (!walletPublicKey) {
      setPricingError("Connect wallet to share discount offers.");
      return;
    }

    let buyerKey: PublicKey;
    try {
      buyerKey = new PublicKey(peer);
    } catch {
      setPricingError("Selected peer is not a valid wallet address.");
      return;
    }

    setSharingOffer(true);
    setPricingError(null);
    try {
      const priceRaw = parseAmountToU64(pricingPrice.trim(), PRICE_DECIMALS);
      const amountRaw = parseAmountToU64(pricingQuantity.trim(), verifiedListing.baseDecimals);

      const result = await createOfferTransaction({
        connection,
        seller: walletPublicKey,
        signAndSendTransaction,
        listingAddress: new PublicKey(verifiedListing.address),
        listingId: BigInt(verifiedListing.listingId),
        priceRaw,
        amountRaw,
        buyer: buyerKey,
        installmental: pricingInstallmental,
      });

      const messageText = `Price Adjustment for ${verifiedListing.baseSymbol}`;
      await sendMessage(messageText, result.offerId.toString());

      setShowPricingModal(false);
      setPricingStep("identify");
      setPricingListingId("");
      setPricingPrice("1.05");
      setPricingQuantity("5000");
      setPricingNote("");
      setVerifiedListing(null);
      setPricingInstallmental(true);
    } catch (thrown) {
      setPricingError(thrown instanceof Error ? thrown.message : "Failed to share offer.");
    } finally {
      setSharingOffer(false);
    }
  };

  const openOfferDetails = async (offerId: string) => {
    if (!walletAddress) {
      setError("Connect wallet to view offer details.");
      return;
    }

    setOfferModalVisible(true);
    setOfferModalOfferId(offerId);
    setOfferLoading(true);
    setOfferError(null);
    setOfferActionError(null);
    setOfferDetails(null);
    setOfferModalRole(null);

    try {
      const details = await getOfferById(connection, offerId);
      if (!details) throw new Error("Offer not found or already settled.");

      const viewer = walletAddress;
      const seller = details.seller.toBase58();
      const buyer = details.buyer.toBase58();
      if (viewer === seller) {
        setOfferModalRole("owner");
      } else if (viewer === buyer) {
        setOfferModalRole("buyer");
      } else {
        throw new Error("This offer is restricted to seller and designated buyer.");
      }

      setOfferDetails(details);
      const baseDecimals = details.listing?.baseDecimals ?? 0;
      setBuyerAmountInput(formatAmount(details.amount, baseDecimals).toString());
    } catch (thrown) {
      setOfferError(thrown instanceof Error ? thrown.message : "Failed to load offer details.");
    } finally {
      setOfferLoading(false);
    }
  };

  const closeOfferModal = () => {
    setOfferModalVisible(false);
    setOfferModalOfferId(null);
    setOfferDetails(null);
    setOfferModalRole(null);
    setOfferError(null);
    setOfferActionError(null);
    setBuyerAmountError(null);
  };

  const handleCancelOffer = async () => {
    if (!offerDetails || !walletPublicKey) return;
    setOfferActionLoading(true);
    setOfferActionError(null);
    try {
      const { signature } = await cancelOfferTransaction({
        connection,
        seller: walletPublicKey,
        signAndSendTransaction,
        offerAddress: offerDetails.pubkey,
        offerId: offerDetails.offerId,
      });

      try {
        const token = await ensureAuth();
        if (token && offerDetails.listing) {
          await recordListingActivity({
            token,
            listingAddress: offerDetails.listing.pubkey.toBase58(),
            txHash: signature,
            type: "DISCOUNT_CANCELLED",
          });
        }
      } catch {}

      closeOfferModal();
    } catch (thrown) {
      setOfferActionError(thrown instanceof Error ? thrown.message : "Failed to cancel offer.");
    } finally {
      setOfferActionLoading(false);
    }
  };

  const handleBuyerAmountChange = (value: string) => {
    if (!offerDetails) return;
    const clean = value.replace(/,/g, "");
    if (!clean) {
      setBuyerAmountInput("");
      return;
    }
    const next = Number(clean);
    if (!Number.isFinite(next)) return;

    const baseDecimals = offerDetails.listing?.baseDecimals ?? 0;
    const maxUi = formatAmount(offerDetails.amount, baseDecimals);
    if (next > maxUi) {
      setBuyerAmountError(`Maximum available is ${maxUi.toLocaleString()}`);
      setBuyerAmountInput(maxUi.toString());
      return;
    }
    setBuyerAmountError(null);
    setBuyerAmountInput(clean);
  };

  const handleBuyOffer = async () => {
    if (!offerDetails || !walletPublicKey) return;
    const amountNumber = Number(buyerAmountInput.replace(/,/g, "")) || 0;
    const baseDecimals = offerDetails.listing?.baseDecimals ?? 0;
    const maxAmountUi = formatAmount(offerDetails.amount, baseDecimals);

    if (amountNumber <= 0) {
      setOfferActionError("Enter the amount of tokens to purchase.");
      return;
    }
    if (!offerDetails.installmental && amountNumber !== maxAmountUi) {
      setOfferActionError("This offer requires the full amount.");
      return;
    }

    setOfferActionLoading(true);
    setOfferActionError(null);
    try {
      const amountRaw = parseAmountToU64(amountNumber.toString(), baseDecimals);
      const result = await payOfferTransaction({
        connection,
        buyer: walletPublicKey,
        signAndSendTransaction,
        offerAddress: offerDetails.pubkey,
        baseAmountRaw: amountRaw,
        offerId: offerDetails.offerId,
      });

      try {
        const token = await ensureAuth();
        if (token) {
          await recordListingActivity({
            token,
            listingAddress: result.listingAddress,
            txHash: result.signature,
            type: "DISCOUNT_PURCHASE",
          });
        }
      } catch {}

      closeOfferModal();
    } catch (thrown) {
      setOfferActionError(thrown instanceof Error ? thrown.message : "Failed to complete purchase.");
    } finally {
      setOfferActionLoading(false);
    }
  };

  const amountNumber = Number(buyerAmountInput.replace(/,/g, "")) || 0;
  const priceUi = offerDetails ? formatAmount(offerDetails.price, PRICE_DECIMALS) : 0;
  const costEstimate = amountNumber * priceUi;
  const listingAddress = offerDetails?.listing?.pubkey?.toBase58();

  return (
    <View className="flex-1 bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-4">
      <View className="mb-3 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => router.push("/(otc)/message")}
              className="mr-3 h-9 w-9 items-center justify-center rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
            >
              <MaterialIcons name="arrow-back" size={18} color="#1b1f29" />
            </Pressable>
            <View>
              <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{peerLabel}</Text>
              <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">{peer}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              setPricingStep("identify");
              setPricingError(null);
              setShowPricingModal(true);
            }}
            className="h-9 w-9 items-center justify-center rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
          >
            <MaterialIcons name="add" size={18} color="#1b1f29" />
          </Pressable>
        </View>
      </View>

      {error ? (
        <View className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <Text className="text-xs text-red-700 dark:text-red-300">{error}</Text>
        </View>
      ) : null}

      <ScrollView
        className="flex-1 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-3 py-3"
        contentContainerStyle={{ paddingBottom: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View className="py-8">
            <ActivityIndicator size="small" color="#4b6bfb" />
          </View>
        ) : messages.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-6">
            <Text className="text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">No messages yet.</Text>
          </View>
        ) : (
          messages.map((message) => {
            const mine = walletAddress && message.sender === walletAddress;
            return (
              <View
                key={message._id ?? `${message.sender}-${message.timestamp}`}
                className={`mb-3 max-w-[90%] rounded-2xl px-3 py-2 ${
                  mine
                    ? "self-end bg-[#4b6bfb]"
                    : "self-start border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
                }`}
              >
                <Text className={`text-sm ${mine ? "text-white" : "text-[#1b1f29] dark:text-[#f3f5ff]"}`}>
                  {message.message}
                </Text>
                {message.offering_id ? (
                  <Pressable
                    onPress={() => openOfferDetails(String(message.offering_id))}
                    className={`mt-2 rounded-lg px-2 py-1 ${
                      mine ? "bg-white/20" : "border border-[#d7deef] dark:border-[#30384c]"
                    }`}
                  >
                    <Text className={`text-xs font-semibold ${mine ? "text-white" : "text-[#4b6bfb]"}`}>
                      View offer details
                    </Text>
                  </Pressable>
                ) : null}
                <View className="mt-1 flex-row items-center justify-end">
                  <Text className={`text-[10px] ${mine ? "text-white/80" : "text-[#7d8699] dark:text-[#8f97b5]"}`}>
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </Text>
                  {mine ? (
                    <MaterialIcons
                      name={message.read ? "done-all" : "done"}
                      size={12}
                      color={message.read ? "#ffffff" : "#dbeafe"}
                      style={{ marginLeft: 4 }}
                    />
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View className="mt-2 flex-row items-center rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Type your message..."
          placeholderTextColor="#7d8699"
          className="h-11 flex-1 px-2 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
        />
        <Pressable
          onPress={() => void sendMessage()}
          disabled={sending || !draft.trim()}
          className={`h-9 w-9 items-center justify-center rounded-full ${
            sending || !draft.trim() ? "bg-[#9fb0fc]" : "bg-[#4b6bfb]"
          }`}
        >
          <MaterialIcons name="send" size={16} color="#fff" />
        </Pressable>
      </View>

      <Modal transparent visible={showPricingModal} animationType="fade" onRequestClose={() => setShowPricingModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Share Pricing Terms</Text>
              <Pressable onPress={() => setShowPricingModal(false)} className="h-8 w-8 items-center justify-center rounded-full border border-[#e2e6f0] dark:border-[#30384c]">
                <MaterialIcons name="close" size={16} color="#7d8699" />
              </Pressable>
            </View>

            {pricingStep === "identify" ? (
              <View>
                <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Listing ID / address</Text>
                <TextInput
                  value={pricingListingId}
                  onChangeText={setPricingListingId}
                  placeholder="Ex: 1042 or listing address"
                  placeholderTextColor="#7d8699"
                  className="h-11 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                />
                <Pressable onPress={() => void verifyListingForPricing()} className="mt-4 h-11 items-center justify-center rounded-xl bg-[#4b6bfb]">
                  {verifying ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-sm font-semibold text-white">Verify listing</Text>}
                </Pressable>
              </View>
            ) : (
              <View>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">Configure</Text>
                  <Pressable onPress={() => setPricingStep("identify")}>
                    <Text className="text-xs font-semibold text-[#4b6bfb]">Change listing</Text>
                  </Pressable>
                </View>

                <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Price (USDC)</Text>
                <TextInput
                  value={pricingPrice}
                  onChangeText={setPricingPrice}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#7d8699"
                  className="mb-3 h-11 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                />

                <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Quantity</Text>
                <TextInput
                  value={pricingQuantity}
                  onChangeText={setPricingQuantity}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#7d8699"
                  className="mb-3 h-11 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                />

                <View className="mb-3 flex-row items-center justify-between rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-2">
                  <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Installment payment</Text>
                  <Switch value={pricingInstallmental} onValueChange={setPricingInstallmental} />
                </View>

                <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Note (optional)</Text>
                <TextInput
                  value={pricingNote}
                  onChangeText={setPricingNote}
                  placeholder="Any extra terms..."
                  placeholderTextColor="#7d8699"
                  multiline
                  className="min-h-[64px] rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-2 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                />
                <Pressable
                  onPress={() => void shareOffer()}
                  disabled={sharingOffer}
                  className={`mt-4 h-11 items-center justify-center rounded-xl ${sharingOffer ? "bg-[#9fb0fc]" : "bg-[#4b6bfb]"}`}
                >
                  {sharingOffer ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-sm font-semibold text-white">Share terms</Text>}
                </Pressable>
              </View>
            )}

            {pricingError ? (
              <View className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                <Text className="text-xs text-red-700 dark:text-red-300">{pricingError}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal transparent visible={offerModalVisible} animationType="fade" onRequestClose={closeOfferModal}>
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                {offerModalRole === "owner" ? "Owner controls" : "Buyer details"}
              </Text>
              <Pressable onPress={closeOfferModal} className="h-8 w-8 items-center justify-center rounded-full border border-[#e2e6f0] dark:border-[#30384c]">
                <MaterialIcons name="close" size={16} color="#7d8699" />
              </Pressable>
            </View>

            {offerLoading ? (
              <ActivityIndicator size="small" color="#4b6bfb" />
            ) : offerError ? (
              <View className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                <Text className="text-xs text-red-700 dark:text-red-300">{offerError}</Text>
              </View>
            ) : offerDetails ? (
              <View>
                <View className="rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] p-3">
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Listing</Text>
                    <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      {shortAddress(listingAddress ?? offerDetails.listingId.toString())}
                    </Text>
                  </View>
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Price</Text>
                    <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      ${priceUi.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </Text>
                  </View>
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Available</Text>
                    <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      {offerDetails.listing ? formatAmount(offerDetails.amount, offerDetails.listing.baseDecimals).toLocaleString() : offerDetails.amount.toString()} tokens
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Payment</Text>
                    <Text className="text-xs font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                      {offerDetails.installmental ? "Installments allowed" : "Full payment required"}
                    </Text>
                  </View>
                </View>

                {offerModalRole === "buyer" ? (
                  <View className="mt-3">
                    <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Amount to buy</Text>
                    <TextInput
                      value={buyerAmountInput}
                      onChangeText={handleBuyerAmountChange}
                      keyboardType="decimal-pad"
                      editable={offerDetails.installmental}
                      className="h-11 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                    />
                    {buyerAmountError ? (
                      <Text className="mt-1 text-xs text-red-700 dark:text-red-300">{buyerAmountError}</Text>
                    ) : null}
                    <Text className="mt-2 text-xs text-[#7d8699] dark:text-[#8f97b5]">
                      Estimated cost: ${costEstimate.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </Text>
                    <Pressable
                      onPress={() => void handleBuyOffer()}
                      disabled={offerActionLoading}
                      className={`mt-4 h-11 items-center justify-center rounded-xl ${offerActionLoading ? "bg-[#9fb0fc]" : "bg-[#4b6bfb]"}`}
                    >
                      {offerActionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-sm font-semibold text-white">Buy now</Text>}
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => void handleCancelOffer()}
                    disabled={offerActionLoading}
                    className={`mt-4 h-11 items-center justify-center rounded-xl ${offerActionLoading ? "bg-red-300" : "bg-red-500"}`}
                  >
                    {offerActionLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-sm font-semibold text-white">Cancel offer</Text>}
                  </Pressable>
                )}

                {offerActionError ? (
                  <View className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                    <Text className="text-xs text-red-700 dark:text-red-300">{offerActionError}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text className="text-sm text-[#7d8699] dark:text-[#8f97b5]">
                Offer #{offerModalOfferId ?? "unknown"}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
