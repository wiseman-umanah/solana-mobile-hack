import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { getWalletPublicKey } from "../lib/wallet";
import { requestBackendToken } from "../lib/backendAuth";

type BackendAuthContextValue = {
  token: string | null;
  ensureAuth: () => Promise<string | null>;
  clearAuth: () => void;
};

const BackendAuthContext = createContext<BackendAuthContextValue | null>(null);

export function BackendAuthProvider({ children }: { children: React.ReactNode }) {
  const { account, signMessage } = useMobileWallet();
  const walletPublicKey = useMemo(() => getWalletPublicKey(account ?? null), [account]);
  const walletAddress = walletPublicKey?.toBase58() ?? null;

  const [token, setToken] = useState<string | null>(null);
  const [tokenWalletAddress, setTokenWalletAddress] = useState<string | null>(null);
  const authInFlightRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (!walletAddress || tokenWalletAddress !== walletAddress) {
      setToken(null);
      setTokenWalletAddress(walletAddress);
    }
  }, [walletAddress, tokenWalletAddress]);

  const clearAuth = useCallback(() => {
    setToken(null);
  }, []);

  const ensureAuth = useCallback(async () => {
    if (!walletPublicKey) return null;

    const currentWallet = walletPublicKey.toBase58();
    if (token && tokenWalletAddress === currentWallet) {
      return token;
    }
    if (authInFlightRef.current) {
      return authInFlightRef.current;
    }

    authInFlightRef.current = (async () => {
      try {
        const nextToken = await requestBackendToken({ walletPublicKey, signMessage });
        setToken(nextToken);
        setTokenWalletAddress(currentWallet);
        return nextToken;
      } catch (error) {
        console.error("Failed to authenticate with backend", error);
        setToken(null);
        return null;
      } finally {
        authInFlightRef.current = null;
      }
    })();

    return authInFlightRef.current;
  }, [walletPublicKey, signMessage, token, tokenWalletAddress]);

  useEffect(() => {
    if (!walletPublicKey || !walletAddress) return;
    if (token && tokenWalletAddress === walletAddress) return;
    void ensureAuth();
  }, [walletPublicKey, walletAddress, token, tokenWalletAddress, ensureAuth]);

  const value = useMemo(
    () => ({ token, ensureAuth, clearAuth }),
    [token, ensureAuth, clearAuth]
  );

  return <BackendAuthContext.Provider value={value}>{children}</BackendAuthContext.Provider>;
}

export function useBackendAuth() {
  const ctx = useContext(BackendAuthContext);
  if (!ctx) {
    throw new Error("useBackendAuth must be used within BackendAuthProvider");
  }
  return ctx;
}
