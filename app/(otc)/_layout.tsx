import React, { useEffect, useMemo, useState } from "react";
import { Platform, StatusBar as RNStatusBar, StyleSheet, useColorScheme } from "react-native";
import { Tabs } from "expo-router";
import { MaterialIcons, AntDesign } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import * as NavigationBar from "expo-navigation-bar";
import { ThemeMode, themes } from "../../constants/theme";
import { ThemePreferenceProvider } from "../../contexts/ThemePreferenceContext";

export default function OtcLayout() {
  const system = useColorScheme();
  const { setColorScheme } = useNativeWindColorScheme();
  const insets = useSafeAreaInsets();
  const systemMode: ThemeMode = system === "dark" ? "dark" : "light";
  const [themeOverride, setThemeOverride] = useState<ThemeMode | null>(null);
  const themeMode = themeOverride ?? systemMode;
  const theme = useMemo(() => themes[themeMode], [themeMode]);

  useEffect(() => {
    setColorScheme(themeMode);
  }, [setColorScheme, themeMode]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const applyNavigationBar = async () => {
      try {
        await NavigationBar.setBackgroundColorAsync(theme.surfaceCard);
        await NavigationBar.setButtonStyleAsync(themeMode === "dark" ? "light" : "dark");
      } catch {
        // Best effort: some Android variants may reject these calls.
      }
    };
    void applyNavigationBar();
  }, [theme.surfaceCard, themeMode]);

  const themeContextValue = useMemo(
    () => ({
      themeMode,
      setThemeMode: (mode: ThemeMode) => setThemeOverride(mode),
      toggleTheme: () =>
        setThemeOverride((prev) => {
          const current = prev ?? systemMode;
          return current === "dark" ? "light" : "dark";
        }),
    }),
    [themeMode, systemMode]
  );

  return (
    <SafeAreaView
      style={[styles.appRoot, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      <RNStatusBar
        barStyle={themeMode === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
        translucent={false}
      />
      <ThemePreferenceProvider value={themeContextValue}>
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: {
              backgroundColor: "transparent",
            },
            tabBarShowLabel: false,
            tabBarStyle: {
              height: 68 + insets.bottom,
              paddingTop: 8,
              paddingBottom: insets.bottom,
              backgroundColor: theme.surfaceCard,
              borderTopWidth: 1,
              borderTopColor: theme.borderSubtle,
              borderRadius: 0,
            },
            tabBarActiveTintColor: theme.foreground,
            tabBarInactiveTintColor: theme.textMuted,
            tabBarIconStyle: {
              marginTop: 2,
            },
          }}
        >
          <Tabs.Screen
            name="dashboard"
            options={{
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="trending-up" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="create"
            options={{
              tabBarIcon: ({ color, size }) => (
                <AntDesign name="plus" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="listing/index"
            options={{
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="shopping-cart" size={size} color={color} />
              ),
              title: "Listing",
            }}
          />
          <Tabs.Screen
            name="message/index"
            options={{
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="chat-bubble-outline" size={size} color={color} />
              ),
              title: "Messages",
            }}
          />
          <Tabs.Screen
            name="message/[peer]"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="person-outline" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </ThemePreferenceProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
});
