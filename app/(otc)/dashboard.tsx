import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

const metricCards = [
  {
    label: "Wallet balance",
    value: "13.4821 SOL",
    icon: "attach-money",
    accentBg: "bg-emerald-500/15",
    accentText: "text-emerald-600",
  },
  {
    label: "Token holdings",
    value: "18",
    icon: "layers",
    accentBg: "bg-blue-500/15",
    accentText: "text-blue-600",
  },
  {
    label: "Owned listings",
    value: "6",
    icon: "description",
    accentBg: "bg-violet-500/15",
    accentText: "text-violet-600",
  },
  {
    label: "Active listings",
    value: "4",
    icon: "chat",
    accentBg: "bg-amber-500/15",
    accentText: "text-amber-600",
  },
] as const;

const quickActions = [
  {
    label: "Create listing",
    description: "Draft a new OTC offering for your token holders.",
    href: "/(otc)/create",
  },
  {
    label: "Browse marketplace",
    description: "Discover live OTC opportunities from other sellers.",
    href: "/(otc)/listing",
  },
  {
    label: "Open messages",
    description: "Continue negotiations with counterparties.",
    href: "/(otc)/message",
  },
  {
    label: "View analytics",
    description: "Monitor historical fills and engagement.",
    href: "/(otc)/dashboard",
  },
] as const;

const recentActivity = [
  { title: "Listing created", detail: "USDC / BONK • 2 mins ago", icon: "north-east" },
  { title: "Partial fill completed", detail: "USDC / SOL • 10 mins ago", icon: "check-circle" },
  { title: "Counterparty messaged", detail: "DM thread #A29 • 18 mins ago", icon: "mail" },
] as const;

const Dashboard = () => {
  return (
    <ScrollView
      className="flex-1 bg-[#f6f7fb] dark:bg-[#10131b] px-3 py-4"
      contentContainerStyle={{ paddingBottom: 18 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-4 rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="mb-5 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="mr-3 h-14 w-14 items-center justify-center rounded-2xl bg-[#4b6bfb]/15">
              <MaterialIcons name="trending-up" size={28} color="#4b6bfb" />
            </View>
            <View>
              <Text className="text-2xl font-bold text-[#1b1f29] dark:text-[#f3f5ff]">Portfolio overview</Text>
              <Text className="mt-1 text-xs text-[#7d8699] dark:text-[#8f97b5]">
                Track balances and listing performance in one place.
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="rounded-full border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-3 py-2">
            <Text className="text-[10px] font-semibold uppercase tracking-[1.8px] text-[#4b6bfb]">
              2j3k...9x1f
            </Text>
          </View>
        </View>
      </View>

      <View className="mb-4">
        <View className="flex-row flex-wrap justify-between">
          {metricCards.map((card) => (
            <View
              key={card.label}
              className="mb-3 w-[48.5%] rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-4"
            >
              <View
                className={`h-11 w-11 items-center justify-center rounded-2xl ${card.accentBg}`}
              >
                <MaterialIcons
                  name={card.icon}
                  size={20}
                  color={card.accentText === "text-emerald-600" ? "#16a34a" : card.accentText === "text-blue-600" ? "#2563eb" : card.accentText === "text-violet-600" ? "#7c3aed" : "#d97706"}
                />
              </View>
              <Text className="mt-3 text-xl font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{card.value}</Text>
              <Text className="mt-1 text-[10px] uppercase tracking-[1px] text-[#7d8699] dark:text-[#8f97b5]">
                {card.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mb-4 rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="mb-2 flex-row items-center">
          <MaterialIcons name="bar-chart" size={22} color="#4b6bfb" />
          <Text className="ml-2 text-lg font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Quick actions</Text>
        </View>
        <Text className="mb-4 text-sm text-[#7d8699] dark:text-[#8f97b5]">
          Launch a listing, scout new opportunities, or follow up with counterparties.
        </Text>

        {quickActions.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => router.push(action.href)}
            className="mb-3 rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-4"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{action.label}</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#4b6bfb" />
            </View>
            <Text className="mt-2 text-xs text-[#7d8699] dark:text-[#8f97b5]">{action.description}</Text>
          </Pressable>
        ))}
      </View>

      <View className="rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-5 shadow-sm">
        <View className="mb-2 flex-row items-center">
          <MaterialIcons name="timeline" size={22} color="#4b6bfb" />
          <Text className="ml-2 text-lg font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">Recent activity</Text>
        </View>
        <Text className="mb-4 text-sm text-[#7d8699] dark:text-[#8f97b5]">
          Latest actions recorded in your OTC flow.
        </Text>

        {recentActivity.map((item) => (
          <View
            key={item.title}
            className="mb-3 flex-row items-center rounded-2xl border border-[#e2e6f0] dark:border-[#30384c] bg-[#f1f3f8] dark:bg-[#1f2431] px-4 py-3"
          >
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-[#4b6bfb]/15">
              <MaterialIcons name={item.icon} size={18} color="#4b6bfb" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-[#1b1f29] dark:text-[#f3f5ff]">{item.title}</Text>
              <Text className="text-xs text-[#7d8699] dark:text-[#8f97b5]">{item.detail}</Text>
            </View>
          </View>
        ))}
      </View>
      <View className="h-4" />
    </ScrollView>
  );
};

export default Dashboard;
