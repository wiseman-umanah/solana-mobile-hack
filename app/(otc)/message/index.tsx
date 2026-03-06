import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { conversations } from "./data";

export default function MessageListScreen() {
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newPeer, setNewPeer] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (contact) =>
        contact.name.toLowerCase().includes(q) ||
        contact.address.toLowerCase().includes(q)
    );
  }, [search]);

  const openChat = (peerId: string) => {
    router.push(`/(otc)/message/${peerId}`);
  };

  const startNewConversation = () => {
    const normalized = newPeer.trim().toLowerCase().replace(/\s+/g, "-");
    if (!normalized) return;
    setShowNewModal(false);
    setNewPeer("");
    setNewMessage("");
    router.push(`/(otc)/message/${normalized}`);
  };

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

      <ScrollView showsVerticalScrollIndicator={false}>
        {filteredContacts.map((contact) => (
          <Pressable
            key={contact.id}
            onPress={() => openChat(contact.id)}
            className="mb-3 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] px-4 py-4 shadow-sm"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center">
                  <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{contact.name}</Text>
                  {contact.online ? <View className="ml-2 h-2 w-2 rounded-full bg-green-500" /> : null}
                </View>
                <Text className="mt-1 text-xs text-[#7d8699] dark:text-[#8f97b5]">{contact.address}</Text>
                <Text className="mt-2 text-xs text-[#4c5465] dark:text-[#c5cbe3]">{contact.preview}</Text>
              </View>

              <View className="items-end">
                <Text className="text-[10px] text-[#7d8699] dark:text-[#8f97b5]">
                  {contact.messages[contact.messages.length - 1]?.time ?? ""}
                </Text>
                {contact.unread > 0 ? (
                  <View className="mt-2 rounded-full bg-[#4b6bfb] px-2 py-0.5">
                    <Text className="text-[10px] font-semibold text-white">{contact.unread}</Text>
                  </View>
                ) : (
                  <MaterialIcons name="done-all" size={14} color="#94a3b8" style={{ marginTop: 8 }} />
                )}
              </View>
            </View>
          </Pressable>
        ))}
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

            <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Recipient</Text>
            <TextInput
              value={newPeer}
              onChangeText={setNewPeer}
              placeholder="Wallet alias or address"
              placeholderTextColor="#7d8699"
              className="mb-3 h-11 rounded-xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f6f7fb] dark:bg-[#10131b] px-3 text-sm text-[#1b1f29] dark:text-[#f3f5ff]"
            />

            <Text className="mb-1 text-xs font-semibold text-[#7d8699] dark:text-[#8f97b5]">Message</Text>
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
