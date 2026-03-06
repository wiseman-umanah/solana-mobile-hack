import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import "../global.css";

const slides = [
  {
    title: "Discover Private Liquidity",
    subtitle:
      "Find curated OTC opportunities and execute high-value trades with confidence.",
    image: require("../assets/onboarding/onboarding_liquidity.png"),
  },
  {
    title: "Escrow-First Security",
    subtitle:
      "Protect both parties through transparent flows designed for trustless settlement.",
    image: require("../assets/onboarding/onboarding_secure.png"),
  },
  {
    title: "Connect your wallet to be part of the million traders",
    subtitle:
      "Step into DexSwap OTC and start negotiating, listing, and trading in one place.",
    image: require("../assets/onboarding/onboarding_wallet.png"),
  },
] as const;

const Home = () => {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const spinValue = useRef(new Animated.Value(0)).current;
  const [activeSlide, setActiveSlide] = useState(0);
  const [connecting, setConnecting] = useState(false);

  const spinCoin = () => {
    spinValue.setValue(0);
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleNext = () => {
    if (activeSlide >= slides.length - 1) return;
    spinCoin();
    scrollRef.current?.scrollTo({
      x: width * (activeSlide + 1),
      animated: true,
    });
  };

  const handleBack = () => {
    if (activeSlide <= 0) return;
    scrollRef.current?.scrollTo({
      x: width * (activeSlide - 1),
      animated: true,
    });
  };

  const handleConnectWallet = () => {
    if (connecting) return;
    setConnecting(true);
    setTimeout(() => {
      router.replace("/(otc)/dashboard");
    }, 700);
  };

  const handlePrimaryAction = () => {
    if (activeSlide === slides.length - 1) {
      handleConnectWallet();
      return;
    }
    handleNext();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View className="flex-1 bg-[#f6f7fb] dark:bg-[#10131b]">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setActiveSlide(index);
        }}
      >
        {slides.map((slide, index) => (
          <View
            key={slide.title}
            className="px-5 pt-8"
            style={{ width }}
          >
            <View className="overflow-hidden rounded-3xl border border-[#e2e6f0] dark:border-[#30384c] bg-white dark:bg-[#181c27] p-4">
              <View className="relative h-[360px] w-full items-center justify-center rounded-2xl bg-[#f1f3f8] dark:bg-[#1f2431]">
                <Image
                  source={slide.image}
                  resizeMode="cover"
                  className="h-full w-full rounded-2xl"
                />
                <Animated.View
                  style={{ transform: [{ rotate: spin }] }}
                  className="absolute -bottom-6 -right-4"
                >
                  <Image
                    source={require("../assets/onboarding/solana_coin.png")}
                    className="h-24 w-24"
                    resizeMode="contain"
                  />
                </Animated.View>
              </View>

              <View className="px-1 pb-2 pt-6">
                <Text className="text-3xl font-bold leading-10 text-[#1b1f29] dark:text-[#f3f5ff]">
                  {slide.title}
                </Text>
                <Text className="mt-3 text-sm leading-6 text-[#4c5465] dark:text-[#c5cbe3]">
                  {slide.subtitle}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="px-6 pb-8 pt-5">
        <View className="mb-5 flex-row justify-center">
          {slides.map((_, index) => (
            <View
              key={`dot-${index}`}
              className={`mx-1 h-2 rounded-full ${
                index === activeSlide ? "w-6 bg-[#4b6bfb]" : "w-2 bg-[#94a3b8]"
              }`}
            />
          ))}
        </View>

        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleBack}
            disabled={activeSlide === 0}
            className={`h-12 flex-1 items-center justify-center rounded-full border ${
              activeSlide === 0
                ? "border-[#cbd5e1] bg-[#e2e8f0] dark:border-[#30384c] dark:bg-[#1f2431]"
                : "border-[#e2e6f0] bg-white dark:border-[#30384c] dark:bg-[#181c27]"
            }`}
          >
            <Text className="text-sm font-semibold text-[#475569] dark:text-[#c5cbe3]">
              Back
            </Text>
          </Pressable>
          <Pressable
            onPress={handlePrimaryAction}
            className="h-12 flex-[1.6] items-center justify-center rounded-full bg-[#4b6bfb]"
          >
            <Text className="text-sm font-semibold text-white">
              {activeSlide === slides.length - 1
                ? connecting
                  ? "Connecting..."
                  : "Connect Wallet"
                : "Next"}
            </Text>
          </Pressable>
        </View>
        {activeSlide === slides.length - 1 ? (
          <Text className="mt-3 text-center text-xs text-[#7d8699] dark:text-[#8f97b5]">
            Connect your wallet to be part of the million traders.
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export default Home;
