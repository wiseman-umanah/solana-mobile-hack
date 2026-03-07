import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  ImageSourcePropType,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import "../global.css";


const { width: W } = Dimensions.get("window");

const C = {
  bg: "#0B1020",
  bg2: "#111A33",
  surface: "#121A30",
  surface2: "#18233F",
  border: "#263252",
  text: "#F5F8FF",
  textSub: "#A7B3D1",
  accentA: "#14F195",
  accentB: "#9945FF",
  action: "#3B82F6",
};

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
};

const SLIDES: Slide[] = [
  {
    id: "overview",
    title: "Private OTC Trading\non Solana",
    subtitle:
      "List SPL tokens or buy from verified listings in seconds.",
    image: require("../assets/onboarding/onboarding_liquidity_v2.png"),
  },
  {
    id: "seller",
    title: "List Tokens\nin 3 Steps",
    subtitle:
      "Select token, set terms, and publish a listing secured by escrow.",
    image: require("../assets/onboarding/onboarding_security_v2.png"),
  },
  {
    id: "buyer",
    title: "Browse and Buy\nInstantly",
    subtitle:
      "Review listing details and settle transparently from your wallet.",
    image: require("../assets/onboarding/onboarding_network_v2.png"),
  },
];

function SlideHero({
  index,
  activeIndex,
  scrollX,
  image,
}: {
  index: number;
  activeIndex: number;
  scrollX: Animated.Value;
  image: ImageSourcePropType;
}) {
  const inputRange = [(index - 1) * W, index * W, (index + 1) * W];
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.94, 1, 0.94],
    extrapolate: "clamp",
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.7, 1, 0.7],
    extrapolate: "clamp",
  });
  const translateX = scrollX.interpolate({
    inputRange,
    outputRange: [20, 0, -20],
    extrapolate: "clamp",
  });

  const chipAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const coinSpinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1700,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1700,
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, [floatAnim]);

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(coinSpinAnim, {
        toValue: 1,
        duration: 5200,
        useNativeDriver: true,
      })
    );
    spinLoop.start();
    return () => spinLoop.stop();
  }, [coinSpinAnim]);

  useEffect(() => {
    if (activeIndex === 1) {
      chipAnim.setValue(0);
      Animated.timing(chipAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, chipAnim]);

  useEffect(() => {
    if (activeIndex === 2) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 450,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 2 }
      );
      loop.start();
      return () => loop.stop();
    }
  }, [activeIndex, pulseAnim]);

  if (index === 0) {
    const coinFloatY = floatAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -10],
    });
    const coinRotate = coinSpinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    return (
      <Animated.View
        style={[styles.heroCard, { opacity, transform: [{ scale }, { translateX }] }]}
      >
        <Animated.Image source={image} resizeMode="cover" style={styles.heroImageMain} />
        <Animated.Image
          source={require("../assets/onboarding/solana_coin.png")}
          resizeMode="contain"
          style={[
            styles.heroCoin,
            { transform: [{ translateY: coinFloatY }, { rotate: coinRotate }] },
          ]}
        />
      </Animated.View>
    );
  }

  if (index === 1) {
    const artFloatY = floatAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -8],
    });

    return (
      <Animated.View
        style={[styles.heroCard, { opacity, transform: [{ scale }, { translateX }] }]}
      >
        <Animated.Image
          source={image}
          resizeMode="cover"
          style={[styles.heroImageSeller, { transform: [{ translateY: artFloatY }] }]}
        />
        <View style={styles.flowTrack} />
        {["Select Token", "Set Terms", "Publish"].map((label, i) => {
          const start = i * 0.28;
          const end = start + 0.45;
          const localOpacity = chipAnim.interpolate({
            inputRange: [start, end],
            outputRange: [0, 1],
            extrapolate: "clamp",
          });
          const localY = chipAnim.interpolate({
            inputRange: [start, end],
            outputRange: [10, 0],
            extrapolate: "clamp",
          });
          return (
            <Animated.View
              key={label}
              style={[
                styles.flowChip,
                {
                  opacity: localOpacity,
                  transform: [{ translateY: localY }],
                  top: 74 + i * 84,
                },
              ]}
            >
              <View style={styles.flowDot} />
              <Text style={styles.flowChipText}>{label}</Text>
            </Animated.View>
          );
        })}
      </Animated.View>
    );
  }

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.28],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0],
  });
  const buyerArtY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Animated.View
      style={[styles.heroCard, { opacity, transform: [{ scale }, { translateX }] }]}
    >
      <Animated.Image
        source={image}
        resizeMode="cover"
        style={[styles.heroImageBuyer, { transform: [{ translateY: buyerArtY }] }]}
      />
      <View style={styles.listCard}>
        <Text style={styles.listToken}>{"SOL -> USDC"}</Text>
        <Text style={styles.listMeta}>Rate: 1 SOL = 158.2 USDC</Text>
        <Text style={styles.listMeta}>Available: 82.4 SOL</Text>
      </View>
      <View style={styles.buyWrap}>
        <Animated.View
          style={[
            styles.buyPulse,
            { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
          ]}
        />
        <TouchableOpacity style={styles.buyBtn}>
          <Text style={styles.buyBtnText}>Buy Listing</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function SlideItem({
  item,
  index,
  activeIndex,
  scrollX,
}: {
  item: Slide;
  index: number;
  activeIndex: number;
  scrollX: Animated.Value;
}) {
  return (
    <View style={styles.slideWrap}>
      <SlideHero index={index} activeIndex={activeIndex} scrollX={scrollX} image={item.image} />
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );
}

function Pagination({
  scrollX,
  count,
}: {
  scrollX: Animated.Value;
  count: number;
}) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => {
        const width = scrollX.interpolate({
          inputRange: [(i - 1) * W, i * W, (i + 1) * W],
          outputRange: [6, 22, 6],
          extrapolate: "clamp",
        });
        const color = scrollX.interpolate({
          inputRange: [(i - 1) * W, i * W, (i + 1) * W],
          outputRange: ["#2A3658", C.action, "#2A3658"],
          extrapolate: "clamp",
        });

        return <Animated.View key={i} style={[styles.dot, { width, backgroundColor: color }]} />;
      })}
    </View>
  );
}

export default function OnboardingScreen() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const { account, connect } = useMobileWallet();

  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const handleConnect = useCallback(async () => {
    if (isConnecting) return;

    try {
      setIsConnecting(true);
      if (!account) {
        const nextAccount = await connect();
        if (!nextAccount) {
          throw new Error("Wallet connection returned no account.");
        }
      }
      router.replace("/(otc)/dashboard");
    } catch (error) {
      console.warn("Wallet connect failed", error);
      const message = error instanceof Error ? error.message : "Unable to connect wallet.";
      Alert.alert("Wallet Connection Failed", message);
    } finally {
      setIsConnecting(false);
    }
  }, [account, connect, isConnecting]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ctaPulse]);

  const ctaScale = ctaPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.015],
  });

  useEffect(() => {
    if (account) {
      router.replace("/(otc)/dashboard");
    }
  }, [account]);

  return (
		<SafeAreaView style={styles.root} edges={["top", "bottom"]}>
		<StatusBar barStyle="light-content" backgroundColor={C.bg} />

		<Animated.FlatList
			data={SLIDES}
			keyExtractor={(item) => item.id}
			horizontal
			pagingEnabled
			bounces={false}
			showsHorizontalScrollIndicator={false}
			renderItem={({ item, index }) => (
			<SlideItem
				item={item}
				index={index}
				activeIndex={activeIndex}
				scrollX={scrollX}
			/>
			)}
			onViewableItemsChanged={onViewRef.current}
			viewabilityConfig={viewConfigRef.current}
			onScroll={Animated.event(
			[{ nativeEvent: { contentOffset: { x: scrollX } } }],
			{ useNativeDriver: false }
			)}
			scrollEventThrottle={16}
		/>

		<Pagination scrollX={scrollX} count={SLIDES.length} />

		<View style={styles.footer}>
			<Animated.View style={[styles.buyBtn, { transform: [{ scale: ctaScale }], width: "100%" }]}>
			<Pressable
          disabled={isConnecting}
				onPress={handleConnect}
				style={({ pressed }) => [ pressed && { opacity: 0.88 }]}
			>
				<Text style={styles.ctaText}>
            {isConnecting ? "Connecting..." : account ? "Continue" : "Connect Wallet"}
          </Text>
			</Pressable>
			</Animated.View>
		</View>
		</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  slideWrap: {
    width: W,
    paddingHorizontal: 20,
  },
  heroCard: {
    marginTop: 10,
    height: 370,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCoin: {
    width: 78,
    height: 78,
    position: "absolute",
    top: 30,
    right: 22,
    zIndex: 3,
  },
  heroImageMain: {
    width: "90%",
    height: "78%",
    borderRadius: 22,
    opacity: 0.88,
  },
  heroImageSeller: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    height: 136,
    borderRadius: 18,
    opacity: 0.25,
  },
  heroImageBuyer: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    height: 170,
    borderRadius: 18,
    opacity: 0.28,
  },
  heroBadgeRow: {
    marginTop: 26,
    flexDirection: "row",
    gap: 10,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#314163",
    backgroundColor: C.surface2,
  },
  badgeText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "700",
  },
  flowTrack: {
    position: "absolute",
    top: 98,
    left: 60,
    width: 2,
    height: 160,
    backgroundColor: "#2B3A5C",
  },
  flowChip: {
    position: "absolute",
    left: 40,
    right: 32,
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: "#34456B",
  },
  flowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    backgroundColor: C.accentA,
  },
  flowChipText: {
    color: C.text,
    fontSize: 14,
    fontWeight: "700",
  },
  listCard: {
    width: "84%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#33456B",
    backgroundColor: C.surface2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  listToken: {
    color: C.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  listMeta: {
    color: C.textSub,
    fontSize: 13,
    marginBottom: 4,
  },
  buyWrap: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buyPulse: {
    position: "absolute",
    width: 130,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(59,130,246,0.25)",
  },
  buyBtn: {
    height: 52,
    minWidth: 130,
    borderRadius: 26,
    paddingHorizontal: 24,
    backgroundColor: C.action,
    alignItems: "center",
    justifyContent: "center",
  },
  buyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  title: {
    color: C.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 10,
    color: C.textSub,
    fontSize: 15,
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  footer: {
    marginTop: "auto",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.35,
  },
});
