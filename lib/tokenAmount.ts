const U64_MAX = (1n << 64n) - 1n;

export function parseAmountToU64(amount: string, decimals: number): bigint {
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid numeric amount");
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const decimalsSafe = Math.max(0, Math.trunc(decimals));
  const fractionPadded = (fractionalPart + "0".repeat(decimalsSafe)).slice(0, decimalsSafe);

  const raw = BigInt(wholePart) * 10n ** BigInt(decimalsSafe) + BigInt(fractionPadded || "0");
  if (raw < 0n || raw > U64_MAX) {
    throw new Error("Amount does not fit in u64");
  }

  return raw;
}
