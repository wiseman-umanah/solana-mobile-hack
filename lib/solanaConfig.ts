import { PublicKey } from "@solana/web3.js";

const programId = process.env.EXPO_PUBLIC_ESCROW_PROGRAM_ID ?? process.env.EXPO_ESCROW_PROGRAM_ID;
const quoteMint = process.env.EXPO_PUBLIC_ESCROW_QUOTE_MINT ?? process.env.EXPO_ESCROW_QUOTE_MINT;
const feeTreasury = process.env.EXPO_PUBLIC_ESCROW_FEE_TREASURY ?? process.env.EXPO_ESCROW_FEE_TREASURY;

if (!programId || !quoteMint || !feeTreasury) {
  throw new Error("Missing escrow env vars. Set EXPO_PUBLIC_ESCROW_* in mobile/.env");
}

export const ESCROW_PROGRAM_ID = new PublicKey(programId);
export const DEFAULT_QUOTE_MINT = new PublicKey(quoteMint);
export const FEE_TREASURY = new PublicKey(feeTreasury);

export const LISTING_ACCOUNT_SIZE = 32 * 4 + 8 * 5 + 4 + 8;
