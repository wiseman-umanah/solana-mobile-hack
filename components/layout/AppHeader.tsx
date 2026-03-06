import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTheme, ThemeMode } from "../../constants/theme";

type AppHeaderProps = {
  themeMode: ThemeMode;
  theme: AppTheme;
  onToggleTheme: () => void;
};

export default function AppHeader({
  themeMode,
  theme,
  onToggleTheme,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.topWrap, { paddingTop: insets.top }]}>
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: theme.surfaceCard,
            borderColor: theme.borderSubtle,
          },
        ]}
      >
        <View style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
            <Text style={styles.brandMarkText}>D</Text>
          </View>
          <View style={styles.brandTextBlock}>
            <Text style={[styles.brandTitle, { color: theme.foreground }]}>
              DexSwap OTC
            </Text>
            <Text style={[styles.brandSubtitle, { color: theme.textMuted }]}>
              Private liquidity network
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.themeToggle,
              {
                borderColor: theme.borderSubtle,
                backgroundColor: theme.surfaceCard,
              },
              pressed && styles.pressed,
            ]}
            onPress={onToggleTheme}
          >
            <MaterialIcons
              name={themeMode === "dark" ? "light-mode" : "dark-mode"}
              size={16}
              color={theme.foreground}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.walletButton,
              {
                borderColor: theme.borderSubtle,
                backgroundColor: theme.surfaceCard,
              },
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="logout" size={24} color={theme.foreground} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topWrap: {
    width: "100%",
    zIndex: 20,
  },
  headerCard: {
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMarkText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  brandTextBlock: {
    marginLeft: 10,
    minWidth: 0,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  brandSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  walletButton: {
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  walletText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.82,
  },
});
