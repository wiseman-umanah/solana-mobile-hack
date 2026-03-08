import { Buffer } from "buffer";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { DEFAULT_QUOTE_MINT, ESCROW_PROGRAM_ID, FEE_TREASURY, LISTING_ACCOUNT_SIZE } from "./solanaConfig";

const VAULT_SEED = Buffer.from("vault");
const U64_MAX = (1n << 64n) - 1n;
const OFFER_ACCOUNT_SIZE = 8 + 8 + 8 + 8 + 32 + 32 + 1 + 1;

const INSTRUCTION_TAG = {
  InitializeListing: 0,
  DepositTokens: 1,
  Purchase: 2,
  CancelListing: 3,
  InitiateOffer: 5,
  PayOffer: 7,
  CancelOffer: 8,
} as const;

function encodeU64(value: bigint): Buffer {
  if (value < 0n || value > U64_MAX) {
    throw new Error("Value does not fit into u64");
  }
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(value);
  return out;
}

function encodeInitializeListing(params: {
  listingId: bigint;
  pricePerToken: bigint;
  quantity: bigint;
  minBuyAmount: bigint;
  allowPartial: boolean;
}) {
  const data = Buffer.alloc(1 + 8 * 4 + 1);
  data.writeUInt8(INSTRUCTION_TAG.InitializeListing, 0);
  encodeU64(params.listingId).copy(data, 1);
  encodeU64(params.pricePerToken).copy(data, 9);
  encodeU64(params.quantity).copy(data, 17);
  encodeU64(params.minBuyAmount).copy(data, 25);
  data.writeUInt8(params.allowPartial ? 1 : 0, 33);
  return data;
}

function encodeDepositTokens() {
  const data = Buffer.alloc(1);
  data.writeUInt8(INSTRUCTION_TAG.DepositTokens, 0);
  return data;
}

function encodePurchase(quantity: bigint) {
  const data = Buffer.alloc(1 + 8);
  data.writeUInt8(INSTRUCTION_TAG.Purchase, 0);
  encodeU64(quantity).copy(data, 1);
  return data;
}

function encodeCancelListing() {
  const data = Buffer.alloc(1);
  data.writeUInt8(INSTRUCTION_TAG.CancelListing, 0);
  return data;
}

function encodeInitiateOffer(params: {
  offerId: bigint;
  listingId: bigint;
  price: bigint;
  amount: bigint;
  buyer: PublicKey;
  installmental: boolean;
}) {
  const data = Buffer.alloc(1 + 8 * 4 + 32 + 1);
  data.writeUInt8(INSTRUCTION_TAG.InitiateOffer, 0);
  encodeU64(params.offerId).copy(data, 1);
  encodeU64(params.listingId).copy(data, 9);
  encodeU64(params.price).copy(data, 17);
  encodeU64(params.amount).copy(data, 25);
  params.buyer.toBuffer().copy(data, 33);
  data.writeUInt8(params.installmental ? 1 : 0, 65);
  return data;
}

function encodePayOffer(params: { offerId: bigint; baseAmount: bigint }) {
  const data = Buffer.alloc(1 + 8 + 8);
  data.writeUInt8(INSTRUCTION_TAG.PayOffer, 0);
  encodeU64(params.offerId).copy(data, 1);
  encodeU64(params.baseAmount).copy(data, 9);
  return data;
}

function encodeCancelOffer(offerId: bigint) {
  const data = Buffer.alloc(1 + 8);
  data.writeUInt8(INSTRUCTION_TAG.CancelOffer, 0);
  encodeU64(offerId).copy(data, 1);
  return data;
}

async function submitAndConfirm(params: {
  connection: Connection;
  signAndSendTransaction: (transaction: Transaction, minContextSlot: number) => Promise<unknown>;
  tx: Transaction;
}) {
  const { connection, signAndSendTransaction, tx } = params;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  const checkLandedSignature = async (signature: string) => {
    const status = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const confirmation = status.value[0]?.confirmationStatus;
    return confirmation === "confirmed" || confirmation === "finalized";
  };

  const isExpiryError = (value: unknown) => {
    const message = value instanceof Error ? value.message.toLowerCase() : "";
    return (
      message.includes("block height exceeded") ||
      message.includes("blockhash not found") ||
      message.includes("transaction expired") ||
      message.includes("expired: block exceeded")
    );
  };

  const extractSignatureFromError = (value: unknown) => {
    const message = value instanceof Error ? value.message : "";
    const match = message.match(/signature\s+([1-9A-HJ-NP-Za-km-z]{32,})/i);
    return match?.[1] ?? null;
  };

  let signature: string;
  try {
    const maybeSignature = await signAndSendTransaction(tx, 0);
    const resolved = Array.isArray(maybeSignature) ? maybeSignature[0] : maybeSignature;
    if (!resolved || typeof resolved !== "string") {
      throw new Error("Wallet returned empty signature");
    }
    signature = resolved;
  } catch (error) {
    const extracted = extractSignatureFromError(error);
    if (extracted && isExpiryError(error)) {
      const landed = await checkLandedSignature(extracted);
      if (landed) {
        return extracted;
      }
      throw new Error("Transaction expired before confirmation. Please retry and approve faster.");
    }
    throw error;
  }

  try {
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  } catch (error) {
    if (!isExpiryError(error)) {
      throw error;
    }

    if (await checkLandedSignature(signature)) {
      return signature;
    }

    throw new Error("Transaction expired before confirmation. Please retry and approve faster.");
  }
  return signature;
}

export async function createListingTransaction(params: {
  connection: Connection;
  owner: PublicKey;
  signAndSendTransaction: (transaction: Transaction, minContextSlot: number) => Promise<unknown>;
  baseMint: PublicKey;
  pricePerTokenRaw: bigint;
  quantityRaw: bigint;
  minBuyAmountRaw: bigint;
  allowPartial: boolean;
}) {
  const {
    connection,
    owner,
    signAndSendTransaction,
    baseMint,
    pricePerTokenRaw,
    quantityRaw,
    minBuyAmountRaw,
    allowPartial,
  } = params;

  const listingAccount = Keypair.generate();
  const listingId = BigInt(Date.now());
  const listingIdBytes = encodeU64(listingId);

  const [vaultAuthority, vaultBump] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, owner.toBuffer(), listingIdBytes],
    ESCROW_PROGRAM_ID
  );

  const vaultAta = getAssociatedTokenAddressSync(baseMint, vaultAuthority, true, TOKEN_PROGRAM_ID);
  const ownerBaseAta = getAssociatedTokenAddressSync(baseMint, owner, false, TOKEN_PROGRAM_ID);

  const rentLamports = await connection.getMinimumBalanceForRentExemption(LISTING_ACCOUNT_SIZE);
  const resolvedMinBuy = allowPartial ? minBuyAmountRaw : quantityRaw;

  if (resolvedMinBuy <= 0n) {
    throw new Error("Minimum purchase must be greater than zero");
  }
  if (resolvedMinBuy > quantityRaw) {
    throw new Error("Minimum purchase cannot exceed total quantity");
  }

  const instructions: TransactionInstruction[] = [
    SystemProgram.createAccount({
      fromPubkey: owner,
      newAccountPubkey: listingAccount.publicKey,
      lamports: rentLamports,
      space: LISTING_ACCOUNT_SIZE,
      programId: ESCROW_PROGRAM_ID,
    }),
  ];

  const vaultAtaInfo = await connection.getAccountInfo(vaultAta);
  if (!vaultAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(owner, vaultAta, vaultAuthority, baseMint, TOKEN_PROGRAM_ID)
    );
  }

  const ownerAtaInfo = await connection.getAccountInfo(ownerBaseAta);
  if (!ownerAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(owner, ownerBaseAta, owner, baseMint, TOKEN_PROGRAM_ID)
    );
  }

  instructions.push(
    new TransactionInstruction({
      programId: ESCROW_PROGRAM_ID,
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: listingAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: false },
        { pubkey: baseMint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: encodeInitializeListing({
        listingId,
        pricePerToken: pricePerTokenRaw,
        quantity: quantityRaw,
        minBuyAmount: resolvedMinBuy,
        allowPartial,
      }),
    })
  );

  instructions.push(
    new TransactionInstruction({
      programId: ESCROW_PROGRAM_ID,
      keys: [
        { pubkey: owner, isSigner: true, isWritable: true },
        { pubkey: listingAccount.publicKey, isSigner: false, isWritable: true },
        { pubkey: ownerBaseAta, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: encodeDepositTokens(),
    })
  );

  const tx = new Transaction().add(...instructions);
  tx.feePayer = owner;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  tx.partialSign(listingAccount);
  const maybeSignature = await signAndSendTransaction(tx, 0);
  const signature = Array.isArray(maybeSignature) ? maybeSignature[0] : maybeSignature;
  if (!signature || typeof signature !== "string") {
    throw new Error("Wallet returned empty signature");
  }
  try {
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const expired =
      message.includes("block height exceeded") ||
      message.includes("blockhash not found") ||
      message.includes("transaction expired");
    if (!expired) {
      throw error;
    }

    const status = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const confirmation = status.value[0]?.confirmationStatus;
    if (confirmation !== "confirmed" && confirmation !== "finalized") {
      throw new Error("Transaction expired before confirmation. Please retry and approve faster.");
    }
  }

  return {
    signature,
    listingPubkey: listingAccount.publicKey,
    vaultAuthority,
    vaultBump,
  };
}

export async function purchaseListingTransaction(params: {
  connection: Connection;
  buyer: PublicKey;
  signAndSendTransaction: (transaction: Transaction, minContextSlot: number) => Promise<unknown>;
  listingAddress: PublicKey;
  seller: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  quantityRaw: bigint;
  listingId: bigint;
}) {
  const {
    connection,
    buyer,
    signAndSendTransaction,
    listingAddress,
    seller,
    baseMint,
    quoteMint,
    quantityRaw,
    listingId,
  } = params;

  if (quantityRaw <= 0n) {
    throw new Error("Purchase quantity must be greater than zero");
  }

  const listingIdBytes = encodeU64(listingId);
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, seller.toBuffer(), listingIdBytes],
    ESCROW_PROGRAM_ID
  );

  const vaultAta = getAssociatedTokenAddressSync(baseMint, vaultAuthority, true, TOKEN_PROGRAM_ID);
  const feeRecipientQuoteAta = getAssociatedTokenAddressSync(quoteMint, FEE_TREASURY, true, TOKEN_PROGRAM_ID);
  const sellerQuoteAta = getAssociatedTokenAddressSync(quoteMint, seller, false, TOKEN_PROGRAM_ID);
  const buyerQuoteAta = getAssociatedTokenAddressSync(quoteMint, buyer, false, TOKEN_PROGRAM_ID);
  const buyerBaseAta = getAssociatedTokenAddressSync(baseMint, buyer, false, TOKEN_PROGRAM_ID);

  const instructions: TransactionInstruction[] = [];

  if (!(await connection.getAccountInfo(feeRecipientQuoteAta))) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        buyer,
        feeRecipientQuoteAta,
        FEE_TREASURY,
        quoteMint,
        TOKEN_PROGRAM_ID
      )
    );
  }
  if (!(await connection.getAccountInfo(sellerQuoteAta))) {
    instructions.push(
      createAssociatedTokenAccountInstruction(buyer, sellerQuoteAta, seller, quoteMint, TOKEN_PROGRAM_ID)
    );
  }
  if (!(await connection.getAccountInfo(buyerQuoteAta))) {
    instructions.push(
      createAssociatedTokenAccountInstruction(buyer, buyerQuoteAta, buyer, quoteMint, TOKEN_PROGRAM_ID)
    );
  }
  if (!(await connection.getAccountInfo(buyerBaseAta))) {
    instructions.push(
      createAssociatedTokenAccountInstruction(buyer, buyerBaseAta, buyer, baseMint, TOKEN_PROGRAM_ID)
    );
  }

  instructions.push(
    new TransactionInstruction({
      programId: ESCROW_PROGRAM_ID,
      keys: [
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: listingAddress, isSigner: false, isWritable: true },
        { pubkey: sellerQuoteAta, isSigner: false, isWritable: true },
        { pubkey: feeRecipientQuoteAta, isSigner: false, isWritable: true },
        { pubkey: buyerQuoteAta, isSigner: false, isWritable: true },
        { pubkey: buyerBaseAta, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: encodePurchase(quantityRaw),
    })
  );

  const tx = new Transaction().add(...instructions);
  tx.feePayer = buyer;
  const signature = await submitAndConfirm({ connection, signAndSendTransaction, tx });
  return { signature };
}

export async function cancelListingTransaction(params: {
  connection: Connection;
  seller: PublicKey;
  signAndSendTransaction: (transaction: Transaction, minContextSlot: number) => Promise<unknown>;
  listingAddress: PublicKey;
  baseMint: PublicKey;
  listingId: bigint;
}) {
  const { connection, seller, signAndSendTransaction, listingAddress, baseMint, listingId } = params;
  const listingIdBytes = encodeU64(listingId);
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, seller.toBuffer(), listingIdBytes],
    ESCROW_PROGRAM_ID
  );

  const vaultAta = getAssociatedTokenAddressSync(baseMint, vaultAuthority, true, TOKEN_PROGRAM_ID);
  const sellerBaseAta = getAssociatedTokenAddressSync(baseMint, seller, false, TOKEN_PROGRAM_ID);
  const instructions: TransactionInstruction[] = [];

  if (!(await connection.getAccountInfo(sellerBaseAta))) {
    instructions.push(
      createAssociatedTokenAccountInstruction(seller, sellerBaseAta, seller, baseMint, TOKEN_PROGRAM_ID)
    );
  }

  instructions.push(
    new TransactionInstruction({
      programId: ESCROW_PROGRAM_ID,
      keys: [
        { pubkey: seller, isSigner: true, isWritable: true },
        { pubkey: listingAddress, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: sellerBaseAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: encodeCancelListing(),
    })
  );

  const tx = new Transaction().add(...instructions);
  tx.feePayer = seller;
  const signature = await submitAndConfirm({ connection, signAndSendTransaction, tx });
  return { signature };
}

export type EscrowListingAccount = {
  pubkey: PublicKey;
  seller: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  vaultAuthority: PublicKey;
  pricePerToken: bigint;
  quantity: bigint;
  filled: bigint;
  listingId: bigint;
  minBuyAmount: bigint;
  allowPartial: boolean;
  vaultBump: number;
  status: number;
  baseDecimals: number;
  totalCollectedFee: bigint;
};

function decodeListingAccount(data: Buffer, pubkey: PublicKey): EscrowListingAccount {
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
  const vaultAuthority = readPubkey();
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
  offset += 1;
  const totalCollectedFee = readU64();
  const allowPartial = (flags & 0b1) === 1;

  return {
    pubkey,
    seller,
    baseMint,
    quoteMint,
    vaultAuthority,
    pricePerToken,
    quantity,
    filled,
    listingId,
    minBuyAmount,
    allowPartial,
    vaultBump,
    status,
    baseDecimals,
    totalCollectedFee,
  };
}

export async function fetchEscrowListings(connection: Connection) {
  const accounts = await connection.getProgramAccounts(ESCROW_PROGRAM_ID, {
    filters: [{ dataSize: LISTING_ACCOUNT_SIZE }],
  });
  return accounts.map((account) => decodeListingAccount(Buffer.from(account.account.data), account.pubkey));
}

export async function getListingById(connection: Connection, listingId: bigint | string | number) {
  const target = BigInt(listingId);
  const listings = await fetchEscrowListings(connection);
  return listings.find((listing) => listing.listingId === target) ?? null;
}

export type EscrowOfferAccount = {
  pubkey: PublicKey;
  offerId: bigint;
  listingId: bigint;
  price: bigint;
  amount: bigint;
  buyer: PublicKey;
  seller: PublicKey;
  status: number;
  installmental: boolean;
};

function decodeOfferAccount(data: Buffer, pubkey: PublicKey): EscrowOfferAccount {
  let offset = 0;
  const readU64 = () => {
    const value = data.readBigUInt64LE(offset);
    offset += 8;
    return value;
  };
  const readPubkey = () => {
    const pk = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    return pk;
  };

  const offerId = readU64();
  const listingId = readU64();
  const price = readU64();
  const amount = readU64();
  const buyer = readPubkey();
  const seller = readPubkey();
  const status = data.readUInt8(offset);
  offset += 1;
  const installmental = data.readUInt8(offset) === 1;

  return {
    pubkey,
    offerId,
    listingId,
    price,
    amount,
    buyer,
    seller,
    status,
    installmental,
  };
}

export type EnrichedOffer = EscrowOfferAccount & {
  priceUi: number;
  amountUi: number;
  listing: EscrowListingAccount | null;
};

export async function fetchOffers(connection: Connection) {
  const accounts = await connection.getProgramAccounts(ESCROW_PROGRAM_ID, {
    filters: [{ dataSize: OFFER_ACCOUNT_SIZE }],
  });
  return accounts.map((account) => decodeOfferAccount(Buffer.from(account.account.data), account.pubkey));
}

export async function getOfferById(connection: Connection, offerId: bigint | string | number): Promise<EnrichedOffer | null> {
  const target = BigInt(offerId);
  const offers = await fetchOffers(connection);
  const matched = offers.find((offer) => offer.offerId === target);
  if (!matched) return null;

  const listing = await getListingById(connection, matched.listingId);
  const priceUi = Number(matched.price) / 1_000_000;
  const amountUi = listing ? Number(matched.amount) / 10 ** Math.max(0, listing.baseDecimals) : Number(matched.amount);
  return {
    ...matched,
    listing,
    priceUi,
    amountUi,
  };
}

async function fetchOfferAccount(connection: Connection, offerAddress: PublicKey) {
  const info = await connection.getAccountInfo(offerAddress);
  if (!info) return null;
  return decodeOfferAccount(Buffer.from(info.data), offerAddress);
}

export async function createOfferTransaction(params: {
  connection: Connection;
  seller: PublicKey;
  signAndSendTransaction: (transaction: Transaction, minContextSlot: number) => Promise<unknown>;
  listingAddress: PublicKey;
  listingId: bigint;
  priceRaw: bigint;
  amountRaw: bigint;
  buyer: PublicKey;
  installmental: boolean;
}) {
  const {
    connection,
    seller,
    signAndSendTransaction,
    listingAddress,
    listingId,
    priceRaw,
    amountRaw,
    buyer,
    installmental,
  } = params;

  const listing = await getListingById(connection, listingId);
  if (!listing) throw new Error("Listing not found on-chain");
  if (!listing.pubkey.equals(listingAddress)) throw new Error("Listing address mismatch");
  if (!listing.seller.equals(seller)) throw new Error("Only the listing owner can create an offer");

  const offerId = BigInt(Date.now());
  const offerAccount = Keypair.generate();
  const rentLamports = await connection.getMinimumBalanceForRentExemption(OFFER_ACCOUNT_SIZE);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: seller,
      newAccountPubkey: offerAccount.publicKey,
      lamports: rentLamports,
      space: OFFER_ACCOUNT_SIZE,
      programId: ESCROW_PROGRAM_ID,
    }),
    new TransactionInstruction({
      programId: ESCROW_PROGRAM_ID,
      keys: [
        { pubkey: seller, isSigner: true, isWritable: true },
        { pubkey: listingAddress, isSigner: false, isWritable: false },
        { pubkey: offerAccount.publicKey, isSigner: false, isWritable: true },
      ],
      data: encodeInitiateOffer({
        offerId,
        listingId,
        price: priceRaw,
        amount: amountRaw,
        buyer,
        installmental,
      }),
    })
  );
  tx.feePayer = seller;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.partialSign(offerAccount);

  const maybeSignature = await signAndSendTransaction(tx, 0);
  const signature = Array.isArray(maybeSignature) ? maybeSignature[0] : maybeSignature;
  if (!signature || typeof signature !== "string") {
    throw new Error("Wallet returned empty signature");
  }
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

  return {
    signature,
    offerPubkey: offerAccount.publicKey,
    offerId,
  };
}

export async function cancelOfferTransaction(params: {
  connection: Connection;
  seller: PublicKey;
  signAndSendTransaction: (transaction: Transaction, minContextSlot: number) => Promise<unknown>;
  offerAddress: PublicKey;
  offerId?: bigint;
}) {
  const { connection, seller, signAndSendTransaction, offerAddress, offerId } = params;
  const offer = await fetchOfferAccount(connection, offerAddress);
  if (!offer) throw new Error("Offer account not found");
  if (!offer.seller.equals(seller)) throw new Error("Only the offer owner can cancel it");

  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: ESCROW_PROGRAM_ID,
      keys: [
        { pubkey: seller, isSigner: true, isWritable: false },
        { pubkey: offerAddress, isSigner: false, isWritable: true },
      ],
      data: encodeCancelOffer(offerId ?? offer.offerId),
    })
  );
  tx.feePayer = seller;
  const signature = await submitAndConfirm({ connection, signAndSendTransaction, tx });
  return { signature };
}

export async function payOfferTransaction(params: {
  connection: Connection;
  buyer: PublicKey;
  signAndSendTransaction: (transaction: Transaction, minContextSlot: number) => Promise<unknown>;
  offerAddress: PublicKey;
  baseAmountRaw: bigint;
  offerId?: bigint;
}) {
  const { connection, buyer, signAndSendTransaction, offerAddress, baseAmountRaw, offerId } = params;
  const offer = await fetchOfferAccount(connection, offerAddress);
  if (!offer) throw new Error("Offer not found on-chain");
  if (!offer.buyer.equals(buyer)) throw new Error("This offer is assigned to a different buyer");
  if (offer.status === 0 || offer.amount <= 0n) throw new Error("Offer is no longer active");
  if (baseAmountRaw <= 0n) throw new Error("Enter a valid purchase amount");
  if (baseAmountRaw > offer.amount) throw new Error("Requested amount exceeds allocation");

  const listing = await getListingById(connection, offer.listingId);
  if (!listing) throw new Error("Listing not found for this offer");

  const listingIdBytes = encodeU64(listing.listingId);
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, listing.seller.toBuffer(), listingIdBytes],
    ESCROW_PROGRAM_ID
  );
  const vaultAta = getAssociatedTokenAddressSync(listing.baseMint, vaultAuthority, true, TOKEN_PROGRAM_ID);
  const sellerQuoteAta = getAssociatedTokenAddressSync(DEFAULT_QUOTE_MINT, listing.seller, false, TOKEN_PROGRAM_ID);
  const buyerQuoteAta = getAssociatedTokenAddressSync(DEFAULT_QUOTE_MINT, buyer, false, TOKEN_PROGRAM_ID);
  const buyerBaseAta = getAssociatedTokenAddressSync(listing.baseMint, buyer, false, TOKEN_PROGRAM_ID);
  const feeRecipientQuoteAta = getAssociatedTokenAddressSync(DEFAULT_QUOTE_MINT, FEE_TREASURY, true, TOKEN_PROGRAM_ID);

  const instructions: TransactionInstruction[] = [];
  const maybeCreateAta = async (ata: PublicKey, owner: PublicKey, mint: PublicKey) => {
    const info = await connection.getAccountInfo(ata);
    if (!info) {
      instructions.push(createAssociatedTokenAccountInstruction(buyer, ata, owner, mint, TOKEN_PROGRAM_ID));
    }
  };

  await maybeCreateAta(sellerQuoteAta, listing.seller, DEFAULT_QUOTE_MINT);
  await maybeCreateAta(buyerQuoteAta, buyer, DEFAULT_QUOTE_MINT);
  await maybeCreateAta(buyerBaseAta, buyer, listing.baseMint);
  await maybeCreateAta(feeRecipientQuoteAta, FEE_TREASURY, DEFAULT_QUOTE_MINT);

  instructions.push(
    new TransactionInstruction({
      programId: ESCROW_PROGRAM_ID,
      keys: [
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: offerAddress, isSigner: false, isWritable: true },
        { pubkey: listing.pubkey, isSigner: false, isWritable: true },
        { pubkey: sellerQuoteAta, isSigner: false, isWritable: true },
        { pubkey: feeRecipientQuoteAta, isSigner: false, isWritable: true },
        { pubkey: buyerQuoteAta, isSigner: false, isWritable: true },
        { pubkey: buyerBaseAta, isSigner: false, isWritable: true },
        { pubkey: vaultAuthority, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: encodePayOffer({
        offerId: offerId ?? offer.offerId,
        baseAmount: baseAmountRaw,
      }),
    })
  );

  const tx = new Transaction().add(...instructions);
  tx.feePayer = buyer;
  const signature = await submitAndConfirm({ connection, signAndSendTransaction, tx });
  return { signature, listingAddress: listing.pubkey.toBase58() };
}
