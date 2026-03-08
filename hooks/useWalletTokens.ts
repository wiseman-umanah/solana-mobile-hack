import { useEffect, useMemo, useState } from "react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { getWalletPublicKey } from "../lib/wallet";

export type WalletToken = {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
};

export function useWalletTokens() {
  const { account, connection } = useMobileWallet();
  const walletPublicKey = useMemo(() => getWalletPublicKey(account ?? null), [account]);

  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchWalletTokens = async () => {
      if (!walletPublicKey) {
        if (active) setTokens([]);
        return;
      }

      try {
        setLoading(true);
        const parsed = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
          programId: TOKEN_PROGRAM_ID,
        });

        const mapped = parsed.value
          .map((entry) => {
            const info = entry.account.data.parsed?.info;
            const tokenAmount = info?.tokenAmount;
            const amountUi = Number(tokenAmount?.uiAmountString ?? tokenAmount?.uiAmount ?? 0);
            const decimals = Number(tokenAmount?.decimals ?? 0);
            const mint: string = info?.mint;

            if (!mint || !Number.isFinite(amountUi) || amountUi <= 0) return null;

            return {
              mint,
              symbol: mint.slice(0, 4).toUpperCase(),
              name: `Token ${mint.slice(0, 4)}`,
              balance: amountUi,
              decimals,
            } as WalletToken;
          })
          .filter((token): token is WalletToken => !!token)
          .sort((a, b) => b.balance - a.balance);

        if (active) setTokens(mapped);
      } catch (error) {
        console.warn("Failed to fetch wallet tokens", error);
        if (active) setTokens([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchWalletTokens();
    return () => {
      active = false;
    };
  }, [walletPublicKey, connection]);

  return {
    walletPublicKey,
    tokens,
    loading,
  };
}
