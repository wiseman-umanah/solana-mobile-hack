import { useCallback, useEffect, useState } from "react";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { fetchListings, ListingDisplay } from "../lib/listings";

export function useListings() {
  const { connection } = useMobileWallet();
  const [listings, setListings] = useState<ListingDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchListings(connection);
      setListings(next);
    } catch (thrown) {
      console.error("Failed to fetch listings", thrown);
      setError(thrown instanceof Error ? thrown.message : "Failed to fetch listings");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { listings, loading, error, refresh };
}
