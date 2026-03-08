import { Buffer } from "buffer";
import { Connection, PublicKey } from "@solana/web3.js";
import { ESCROW_PROGRAM_ID, LISTING_ACCOUNT_SIZE } from "./solanaConfig";

export type ListingStatus = "PENDING" | "ACTIVE" | "FILLED" | "CANCELLED";

export type ListingDisplay = {
  address: string;
  listingId: string;
  baseMint: string;
  baseSymbol: string;
  sellerAddress: string;
  baseDecimals: number;
  quantityUi: number;
  filledUi: number;
  remainingUi: number;
  minPurchaseUi: number;
  priceUi: number;
  allowPartial: boolean;
  status: ListingStatus;
  vaultBump: number;
};

type EscrowListingAccount = {
  pubkey: PublicKey;
  seller: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  pricePerToken: bigint;
  quantity: bigint;
  filled: bigint;
  listingId: bigint;
  minBuyAmount: bigint;
  allowPartial: boolean;
  vaultBump: number;
  status: number;
  baseDecimals: number;
};

const STATUS_LOOKUP: Record<number, ListingStatus> = {
  0: "PENDING",
  1: "ACTIVE",
  2: "FILLED",
  3: "CANCELLED",
};

function formatAmount(value: bigint, decimals: number) {
  const factor = 10 ** Math.max(0, decimals);
  return Number(value) / factor;
}

export async function fetchListings(connection: Connection): Promise<ListingDisplay[]> {
  const accounts = await connection.getProgramAccounts(ESCROW_PROGRAM_ID, {
    filters: [{ dataSize: LISTING_ACCOUNT_SIZE }],
  });

  const decoded = accounts.map<EscrowListingAccount>((account) => {
    const data = Buffer.from(account.account.data);
    let offset = 0;

    const readPubkey = () => {
      const pk = new PublicKey(data.subarray(offset, offset + 32));
      offset += 32;
      return pk;
    };
    const readU64 = () => {
      const value = data.readBigUInt64LE(offset);
      offset += 8;
      return value;
    };

    const seller = readPubkey();
    const baseMint = readPubkey();
    const quoteMint = readPubkey();
    readPubkey(); // vaultAuthority not needed in display model
    const pricePerToken = readU64();
    const quantity = readU64();
    const filled = readU64();
    const listingId = readU64();
    const minBuyAmount = readU64();
    const flags = data.readUInt8(offset);
    offset += 1;
    const vaultBump = data.readUInt8(offset);
    offset += 1;
    const status = data.readUInt8(offset);
    offset += 1;
    const baseDecimals = data.readUInt8(offset);

    const allowPartial = (flags & 0b1) === 1;

    return {
      pubkey: account.pubkey,
      seller,
      baseMint,
      quoteMint,
      pricePerToken,
      quantity,
      filled,
      listingId,
      minBuyAmount,
      allowPartial,
      vaultBump,
      status,
      baseDecimals,
    };
  });

  return decoded.map((listing) => {
    const quantityUi = formatAmount(listing.quantity, listing.baseDecimals);
    const filledUi = formatAmount(listing.filled, listing.baseDecimals);
    const remainingUi = Math.max(0, quantityUi - filledUi);
    const minPurchaseUi = formatAmount(listing.minBuyAmount, listing.baseDecimals);
    const priceUi = formatAmount(listing.pricePerToken, 6);
    const baseMint = listing.baseMint.toBase58();

    return {
      address: listing.pubkey.toBase58(),
      listingId: listing.listingId.toString(),
      baseMint,
      baseSymbol: `${baseMint.slice(0, 4).toUpperCase()}`,
      sellerAddress: listing.seller.toBase58(),
      baseDecimals: listing.baseDecimals,
      quantityUi,
      filledUi,
      remainingUi,
      minPurchaseUi,
      priceUi,
      allowPartial: listing.allowPartial,
      status: STATUS_LOOKUP[listing.status] ?? "CANCELLED",
      vaultBump: listing.vaultBump,
    };
  });
}
