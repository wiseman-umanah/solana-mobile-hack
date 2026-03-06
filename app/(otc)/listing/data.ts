export type ListingStatus = "ACTIVE" | "PENDING" | "FILLED";

export type Listing = {
  id: string;
  baseSymbol: string;
  sellerAddress: string;
  listingId: number;
  quantityUi: number;
  filledUi: number;
  remainingUi: number;
  minPurchaseUi: number;
  priceUi: number;
  allowPartial: boolean;
  status: ListingStatus;
};

export const sampleListings: Listing[] = [
  {
    id: "L-1",
    baseSymbol: "BONK",
    sellerAddress: "Gf8kS1h2mX7pQe4uA9vL3tZ",
    listingId: 1042,
    quantityUi: 1000000,
    filledUi: 250000,
    remainingUi: 750000,
    minPurchaseUi: 10000,
    priceUi: 0.000028,
    allowPartial: true,
    status: "ACTIVE",
  },
  {
    id: "L-2",
    baseSymbol: "JUP",
    sellerAddress: "9k2LmQvA4sT8pY7cN6rD1xF",
    listingId: 1043,
    quantityUi: 55000,
    filledUi: 0,
    remainingUi: 55000,
    minPurchaseUi: 55000,
    priceUi: 0.94,
    allowPartial: false,
    status: "PENDING",
  },
  {
    id: "L-3",
    baseSymbol: "PYTH",
    sellerAddress: "E3cV8bN1pA4qR6tY2mK7sH5",
    listingId: 1044,
    quantityUi: 240000,
    filledUi: 240000,
    remainingUi: 0,
    minPurchaseUi: 5000,
    priceUi: 0.52,
    allowPartial: true,
    status: "FILLED",
  },
  {
    id: "L-4",
    baseSymbol: "SOL",
    sellerAddress: "D7mL2nQ5vX8tR4aP1sK9uE3",
    listingId: 1045,
    quantityUi: 800,
    filledUi: 130,
    remainingUi: 670,
    minPurchaseUi: 20,
    priceUi: 142.25,
    allowPartial: true,
    status: "ACTIVE",
  },
];
