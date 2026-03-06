import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { ChatMessage, conversations } from "./data";

type PricingStep = "identify" | "configure";

export default function MessageThreadScreen() {
  const params = useLocalSearchParams<{ peer?: string }>();
  const baseContact = useMemo(
    () => conversations.find((item) => item.id === params.peer),
    [params.peer]
  );

  const [messages, setMessages] = useState<ChatMessage[]>(baseContact?.messages ?? []);
  const [draft, setDraft] = useState("");
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingStep, setPricingStep] = useState<PricingStep>("identify");
  const [listingIdInput, setListingIdInput] = useState("");
  const [offerPrice, setOfferPrice] = useState("1.05");
  const [offerQty, setOfferQty] = useState("5000");

  const contact = baseContact ?? {
    id: params.peer ?? "new-peer",
    name: (params.peer ?? "New Peer").replace(/-/g, " "),
    address: "Unknown",
    online: false,
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "me",
      text,
      time: "now",
      delivered: true,
      read: false,
    };
    setMessages((prev) => [...prev, msg]);
    setDraft("");
  };

  const shareOffer = () => {
    const payload = `Price Adjustment for listing ${listingIdInput || "N/A"} • ${offerQty} @ ${offerPrice} USDC`;
    const msg: ChatMessage = {
      id: `offer-${Date.now()}`,
      sender: "me",
      text: payload,
      time: "now",
      delivered: true,
      read: false,
    };
    setMessages((prev) => [...prev, msg]);
    setShowPricingModal(false);
    setPricingStep("identify");
    setListingIdInput("");
  };

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
              <View className="flex-row items-center">
                <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{contact.name}</Text>
                {contact.online ? <View className="ml-2 h-2 w-2 rounded-full bg-green-500" /> : null}
              </View>
              <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">
                {contact.online ? "Online now" : "Last seen recently"}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setShowPricingModal(true)}
            className="h-9 w-9 items-center justify-center rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
          >
            <MaterialIcons name="add" size={18} color="#1b1f29" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-3 py-3"
        contentContainerStyle={{ paddingBottom: 10 }}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            className={`mb-3 max-w-[85%] rounded-2xl px-3 py-2 ${
              message.sender === "me"
                ? "self-end bg-[#4b6bfb]"
                : "self-start border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
            }`}
          >
            <Text
              className={`text-sm ${
                message.sender === "me" ? "text-white" : "text-[#1b1f29] dark:text-[#f3f5ff]"
              }`}
            >
              {message.text}
            </Text>
            <View className="mt-1 flex-row items-center justify-end">
              <Text
                className={`text-[10px] ${
                  message.sender === "me" ? "text-white/80" : "text-[#7d8699] dark:text-[#8f97b5]"
                }`}
              >
                {message.time}
              </Text>
              {message.sender === "me" ? (
                <MaterialIcons
                  name={message.read ? "done-all" : "done"}
                  size={12}
                  color={message.read ? "#ffffff" : "#dbeafe"}
                  style={{ marginLeft: 4 }}
                />
              ) : null}
            </View>
          </View>
        ))}
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
          onPress={sendMessage}
          className="h-9 w-9 items-center justify-center rounded-full bg-[#4b6bfb]"
        >
          <MaterialIcons name="send" size={16} color="#fff" />
        </Pressable>
      </View>

      <Modal
        transparent
        visible={showPricingModal}
        animationType="fade"
        onRequestClose={() => setShowPricingModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Share Pricing Terms</Text>
              <Pressable
                onPress={() => setShowPricingModal(false)}
                className="h-8 w-8 items-center justify-center rounded-full border border-[#e2e6f0] dark:border-[#30384c]"
              >
                <MaterialIcons name="close" size={16} color="#7d8699" />
              </Pressable>
            </View>

            {pricingStep === "identify" ? (
              <View>
                <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Listing ID</Text>
                <TextInput
                  value={listingIdInput}
                  onChangeText={setListingIdInput}
                  placeholder="Ex: LIST-2042"
                  placeholderTextColor="#7d8699"
                  className="h-11 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                />
                <Pressable
                  onPress={() => setPricingStep("configure")}
                  className="mt-4 h-11 items-center justify-center rounded-xl bg-[#4b6bfb]"
                >
                  <Text className="text-sm font-semibold text-white">Verify Listing</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Price (USDC)</Text>
                <TextInput
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                  keyboardType="numeric"
                  className="mb-3 h-11 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                />
                <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Quantity</Text>
                <TextInput
                  value={offerQty}
                  onChangeText={setOfferQty}
                  keyboardType="numeric"
                  className="h-11 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
                />
                <Pressable
                  onPress={shareOffer}
                  className="mt-4 h-11 items-center justify-center rounded-xl bg-[#4b6bfb]"
                >
                  <Text className="text-sm font-semibold text-white">Share Terms</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
