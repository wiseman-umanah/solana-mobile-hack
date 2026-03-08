import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";

const REQUEST_TIMEOUT_MS = 12000;

function resolveBackendBaseUrl() {
  return (
    process.env.EXPO_PUBLIC_BACKEND_URL ??
    "http://localhost:5000"
  );
}

async function fetchWithTimeout(input: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function toNetworkErrorMessage(baseUrl: string) {
  const localhostHint = /localhost|127\.0\.0\.1/.test(baseUrl)
    ? " `localhost` points to the phone/emulator, not your backend machine."
    : "";
  return `Network request failed while reaching backend at ${baseUrl}.${localhostHint}`;
}

export async function requestBackendToken(params: {
  walletPublicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array | Uint8Array[]>;
}) {
  const { walletPublicKey, signMessage } = params;
  const apiBase = resolveBackendBaseUrl();
  const wallet = walletPublicKey.toBase58();

  let nonceRes: Response;
  try {
    nonceRes = await fetchWithTimeout(`${apiBase}/auth/nonce?wallet=${wallet}`);
  } catch (error) {
    throw new Error(toNetworkErrorMessage(apiBase), { cause: error });
  }
  if (!nonceRes.ok) {
    throw new Error(`Failed to request auth nonce (${nonceRes.status})`);
  }

  const noncePayload = await nonceRes.json();
  const encoded = new TextEncoder().encode(noncePayload.nonce);
  const signature = await signMessage(encoded);
  const signatureBytes = Array.isArray(signature) ? signature[0] : signature;
  const signatureBase64 = Buffer.from(signatureBytes).toString("base64");

  let verifyRes: Response;
  try {
    verifyRes = await fetchWithTimeout(`${apiBase}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: wallet, signature: signatureBase64 }),
    });
  } catch (error) {
    throw new Error(toNetworkErrorMessage(apiBase), { cause: error });
  }
  if (!verifyRes.ok) {
    throw new Error(`Authentication failed (${verifyRes.status})`);
  }

  const payload = await verifyRes.json();
  if (!payload?.success || !payload?.token) {
    throw new Error("Authentication failed");
  }

  return payload.token as string;
}

export function getBackendBaseUrl() {
  return resolveBackendBaseUrl();
}
