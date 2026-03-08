import { useEffect, useMemo, useState } from "react";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { getBackendBaseUrl } from "../lib/backendAuth";
import { getWalletPublicKey } from "../lib/wallet";
import { useBackendAuth } from "../contexts/BackendAuthContext";
import { useWalletTokens } from "./useWalletTokens";
import { useListings } from "./useListings";

type BackendActivity = {
  _id?: string;
  listingAddress: string;
  txHash: string;
  type: string;
  occurredAt?: string;
  createdAt?: string;
};

const ACTIVITY_LABELS: Record<string, string> = {
  CREATE: "Listing created",
  PURCHASE: "Listing purchase",
  DISCOUNT_PURCHASE: "Listing discount bought",
  DISCOUNT_CANCELLED: "Discount offer cancelled",
};

export function useDashboardData() {
  const { account, connection } = useMobileWallet();
  const { ensureAuth } = useBackendAuth();
  const { tokens } = useWalletTokens();
  const { listings } = useListings();

  const walletPublicKey = useMemo(() => getWalletPublicKey(account ?? null), [account]);
  const walletAddress = walletPublicKey?.toBase58() ?? null;

  const [walletBalance, setWalletBalance] = useState<string>("-- SOL");
  const [activities, setActivities] = useState<BackendActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const tokenHoldingsCount = tokens.length;
  const myListings = useMemo(
    () => (walletAddress ? listings.filter((item) => item.sellerAddress === walletAddress) : []),
    [listings, walletAddress]
  );
  const ownedListingsCount = myListings.length;
  const activeListingsCount = useMemo(
    () => myListings.filter((item) => item.status === "ACTIVE" && item.remainingUi > 0).length,
    [myListings]
  );

  useEffect(() => {
    let active = true;
    let subscriptionId: number | null = null;

    const fetchBalance = async (showLoading = false) => {
      if (!walletPublicKey) {
        if (active) setWalletBalance("0.0000 SOL");
        return;
      }

      try {
        if (active && showLoading) {
          setWalletBalance("Loading...");
        }
        const lamports = await connection.getBalance(walletPublicKey, "confirmed");
        const sol = lamports / 1_000_000_000;
        if (active) setWalletBalance(`${sol.toFixed(4)} SOL`);
      } catch (error) {
        console.warn("Failed to fetch wallet balance", error);
        if (active) setWalletBalance("-- SOL");
      }
    };

    void fetchBalance(true);

    if (walletPublicKey) {
      subscriptionId = connection.onAccountChange(
        walletPublicKey,
        () => {
          void fetchBalance(false);
        },
        "confirmed"
      );
    }

    return () => {
      active = false;
      if (subscriptionId != null) {
        void connection.removeAccountChangeListener(subscriptionId);
      }
    };
  }, [walletPublicKey, connection, refreshTick]);

  useEffect(() => {
    let active = true;

    const fetchDashboardData = async () => {
      if (!walletPublicKey) {
        if (active) {
          setActivities([]);
          setActivityError(null);
        }
        return;
      }

      setActivityLoading(true);
      setActivityError(null);
      try {
        const token = await ensureAuth();
        if (!token || !active) return;

        const activityRes = await fetch(`${getBackendBaseUrl()}/api/listings/activity`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!activityRes.ok) {
          throw new Error(`Failed to load activity (${activityRes.status})`);
        }

        const activityPayload = await activityRes.json();
        const fetchedActivities: BackendActivity[] = activityPayload?.activities ?? [];
        if (!active) return;
        setActivities(fetchedActivities.slice(0, 5));
      } catch (error) {
        console.error("Failed to fetch dashboard backend data", error);
        if (active) {
          setActivityError("Unable to load activity right now.");
          setActivities([]);
        }
      } finally {
        if (active) setActivityLoading(false);
      }
    };

    void fetchDashboardData();
    return () => {
      active = false;
    };
  }, [walletPublicKey, ensureAuth, refreshTick]);

  const shortAddress = useMemo(() => {
    const addressText = walletPublicKey?.toBase58();
    if (!addressText) return "Wallet not connected";
    return `${addressText.slice(0, 4)}...${addressText.slice(-4)}`;
  }, [walletPublicKey]);

  const metricCards = useMemo(
    () =>
      [
        {
          label: "Wallet balance",
          value: walletBalance,
          icon: "attach-money",
          accentBg: "bg-emerald-500/15",
          accentText: "text-emerald-600",
        },
        {
          label: "Token holdings",
          value: String(tokenHoldingsCount),
          icon: "layers",
          accentBg: "bg-blue-500/15",
          accentText: "text-blue-600",
        },
        {
          label: "Owned listings",
          value: String(ownedListingsCount),
          icon: "description",
          accentBg: "bg-violet-500/15",
          accentText: "text-violet-600",
        },
        {
          label: "Active listings",
          value: String(activeListingsCount),
          icon: "chat",
          accentBg: "bg-amber-500/15",
          accentText: "text-amber-600",
        },
      ] as const,
    [walletBalance, tokenHoldingsCount, ownedListingsCount, activeListingsCount]
  );

  const recentActivity = useMemo(
    () =>
      activities.map((item) => {
        const timestamp = new Date(item.occurredAt ?? item.createdAt ?? Date.now()).toLocaleString();
        const typeLabel = ACTIVITY_LABELS[item.type] ?? item.type;
        const shortListing = item.listingAddress
          ? `${item.listingAddress.slice(0, 4)}...${item.listingAddress.slice(-4)}`
          : "Unknown";
        return {
          key: item._id ?? `${item.txHash}-${item.type}`,
          title: typeLabel,
          detail: `Listing ${shortListing} • ${timestamp}`,
          icon: item.type === "CREATE" ? "north-east" : item.type === "PURCHASE" ? "check-circle" : "history",
        } as const;
      }),
    [activities]
  );

  return {
    shortAddress,
    metricCards,
    recentActivity,
    activityLoading,
    activityError,
    refresh: () => setRefreshTick((prev) => prev + 1),
  };
}
