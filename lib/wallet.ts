import { PublicKey } from "@solana/web3.js";

export type WalletAccountLike = {
  publicKey?: unknown;
  address?: unknown;
};

export function getWalletPublicKey(account?: WalletAccountLike | null): PublicKey | null {
  if (!account) return null;

  const maybePublicKey = account.publicKey;
  if (maybePublicKey && typeof (maybePublicKey as { toBase58?: unknown }).toBase58 === "function") {
    return maybePublicKey as PublicKey;
  }

  const maybeAddress = account.address;
  if (maybeAddress && typeof (maybeAddress as { toBase58?: unknown }).toBase58 === "function") {
    return maybeAddress as PublicKey;
  }

  const addressString =
    typeof maybeAddress === "string"
      ? maybeAddress
      : typeof (maybeAddress as { toString?: unknown })?.toString === "function"
      ? (maybeAddress as { toString: () => string }).toString()
      : null;

  if (!addressString) return null;

  try {
    return new PublicKey(addressString);
  } catch {
    return null;
  }
}
