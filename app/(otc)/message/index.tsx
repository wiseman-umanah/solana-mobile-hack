import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useBackendAuth } from "../../../contexts/BackendAuthContext";
import { getBackendBaseUrl } from "../../../lib/backendAuth";
import { io, Socket } from "socket.io-client";

type ConversationItem = {
  peer: string;
  lastMessage: string;
  timestamp?: string;
  unreadCount: number;
};

export default function MessageListScreen() {
  const params = useLocalSearchParams<{ recipient?: string }>();
  const { ensureAuth } = useBackendAuth();
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPeer, setNewPeer] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await ensureAuth();
      if (!token) return;
      const res = await fetch(`${getBackendBaseUrl()}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load conversations (${res.status})`);
      const payload = await res.json();
      const next: ConversationItem[] = payload?.conversations ?? [];
      setConversations(next);
    } catch (thrown) {
      console.error("Failed to fetch conversations", thrown);
      setError("Unable to load conversations right now.");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [ensureAuth]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    let mounted = true;
    let socket: Socket | null = null;
    const connectSocket = async () => {
      const token = await ensureAuth();
      if (!token || !mounted) return;

      socket = io(getBackendBaseUrl(), {
        auth: { token },
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      socket.on("newMessage", () => {
        void fetchConversations();
      });
      socket.on("messageSent", () => {
        void fetchConversations();
      });
      socket.on("connect_error", (err) => {
        console.debug("Message list socket error", err?.message ?? err);
      });
    };

    void connectSocket();
    return () => {
      mounted = false;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [ensureAuth, fetchConversations]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (contact) =>
        contact.peer.toLowerCase().includes(q) ||
        (contact.lastMessage ?? "").toLowerCase().includes(q)
    );
  }, [search, conversations]);

  const openChat = (peer: string) => {
    router.push(`/(otc)/message/${peer}`);
  };

  const startNewConversation = async () => {
    const recipient = newPeer.trim();
    const firstMessage = newMessage.trim();
    if (!recipient) return;

    try {
      const token = await ensureAuth();
      if (!token) return;

      if (firstMessage) {
        const res = await fetch(`${getBackendBaseUrl()}/api/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            receiver: recipient,
            message: firstMessage,
            tempId: `mobile-${Date.now()}`,
          }),
        });
        if (!res.ok) throw new Error(`Failed to send first message (${res.status})`);
      }

      setShowNewModal(false);
      setNewPeer("");
      setNewMessage("");
      router.push(`/(otc)/message/${recipient}`);
    } catch (thrown) {
      console.error("Failed to start conversation", thrown);
      setError("Unable to start this conversation right now.");
    }
  };

  const shortAddress = (address: string) =>
    address.length > 10 ? `${address.slice(0, 4)}...${address.slice(-4)}` : address;

  useEffect(() => {
    const composeRecipient = params.recipient?.trim();
    if (!composeRecipient) return;
    setShowNewModal(true);
    setNewPeer(composeRecipient);
    setNewMessage("");
    router.replace("/(otc)/message");
  }, [params.recipient]);

  return (
    <View className="flex-1 bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-4">
      <View className="mb-4 rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-3 h-12 w-12 items-center justify-center rounded-2xl bg-[#4b6bfb]/15">
              <MaterialIcons name="forum" size={24} color="#4b6bfb" />
            </View>
            <View>
              <Text className="text-2xl font-bold text-[#1b1f29] dark:text-[#f3f5ff]">Messages</Text>
              <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">Recent chats and offer threads.</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setShowNewModal(true)}
            className="h-10 w-10 items-center justify-center rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431]"
          >
            <MaterialIcons name="add" size={20} color="#1b1f29" />
          </Pressable>
        </View>
      </View>

      <View className="mb-3 flex-row items-center rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-3">
        <MaterialIcons name="search" size={18} color="#7d8699" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search chats..."
          placeholderTextColor="#7d8699"
          className="ml-2 h-11 flex-1 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
        />
      </View>

      {error ? (
        <View className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <Text className="text-xs text-red-700 dark:text-red-300">{error}</Text>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchConversations} />}
      >
        {loading ? (
          <View className="rounded-2xl border border-dashed border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-6">
            <Text className="text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">Loading conversations...</Text>
          </View>
        ) : filteredContacts.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-6">
            <Text className="text-center text-sm text-[#7d8699] dark:text-[#8f97b5]">No conversations yet.</Text>
          </View>
        ) : (
          filteredContacts.map((contact) => (
            <Pressable
              key={contact.peer}
              onPress={() => openChat(contact.peer)}
              className="mb-3 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-4 shadow-sm"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">
                    {shortAddress(contact.peer)}
                  </Text>
                  <Text className="mt-1 text-xs text-[#7d8699] dark:text-[#8f97b5]">{contact.peer}</Text>
                  <Text className="mt-2 text-xs text-[#4c5465] dark:text-[#c5cbe3]">
                    {contact.lastMessage || "No messages yet"}
                  </Text>
                </View>

                <View className="items-end">
                  <Text className="text-[10px] text-[#7d8699] dark:text-[#8f97b5]">
                    {contact.timestamp ? new Date(contact.timestamp).toLocaleDateString() : ""}
                  </Text>
                  {contact.unreadCount > 0 ? (
                    <View className="mt-2 rounded-full bg-[#4b6bfb] px-2 py-0.5">
                      <Text className="text-[10px] font-semibold text-white">{contact.unreadCount}</Text>
                    </View>
                  ) : (
                    <MaterialIcons name="done-all" size={14} color="#94a3b8" style={{ marginTop: 8 }} />
                  )}
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal transparent visible={showNewModal} animationType="fade" onRequestClose={() => setShowNewModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View className="w-full max-w-md rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">New Conversation</Text>
              <Pressable
                onPress={() => setShowNewModal(false)}
                className="h-8 w-8 items-center justify-center rounded-full border border-[#e2e6f0] dark:border-[#30384c]"
              >
                <MaterialIcons name="close" size={16} color="#7d8699" />
              </Pressable>
            </View>

            <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Recipient wallet</Text>
            <TextInput
              value={newPeer}
              onChangeText={setNewPeer}
              placeholder="Wallet address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#7d8699"
              className="mb-3 h-11 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
            />

            <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">First message (optional)</Text>
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type first message..."
              placeholderTextColor="#7d8699"
              multiline
              className="min-h-[88px] rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-2 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
            />

            <Pressable
              onPress={startNewConversation}
              className="mt-4 h-11 items-center justify-center rounded-xl bg-[#4b6bfb]"
            >
              <Text className="text-sm font-semibold text-white">Start Chat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
