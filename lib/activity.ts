import { getBackendBaseUrl } from "./backendAuth";

export async function recordListingActivity(params: {
  token: string;
  listingAddress: string;
  txHash: string;
  type: string;
  occurredAt?: string;
}) {
  const { token, listingAddress, txHash, type, occurredAt } = params;
  const payload: Record<string, string> = {
    listingAddress,
    txHash,
    type,
  };
  if (occurredAt) {
    payload.occurredAt = occurredAt;
  }

  const res = await fetch(`${getBackendBaseUrl()}/api/listings/activity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Failed to record listing activity (${res.status})`);
  }

  return res.json();
}
