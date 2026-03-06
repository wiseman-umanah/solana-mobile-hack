export type ChatMessage = {
  id: string;
  sender: "me" | "peer";
  text: string;
  time: string;
  delivered?: boolean;
  read?: boolean;
};

export type Contact = {
  id: string;
  name: string;
  address: string;
  preview: string;
  online: boolean;
  unread: number;
  messages: ChatMessage[];
};

export const conversations: Contact[] = [
  {
    id: "aurora-desk",
    name: "Aurora Desk",
    address: "8Fa1...2Pq9",
    preview: "Can settle BONK block at updated terms.",
    online: true,
    unread: 2,
    messages: [
      { id: "m1", sender: "peer", text: "Hey, listing still open?", time: "09:12" },
      {
        id: "m2",
        sender: "me",
        text: "Yes. Are you taking full or partial?",
        time: "09:13",
        delivered: true,
        read: true,
      },
      {
        id: "m3",
        sender: "peer",
        text: "Partial. Can settle BONK block at updated terms.",
        time: "09:16",
      },
    ],
  },
  {
    id: "nova-liquidity",
    name: "Nova Liquidity",
    address: "3Gt7...xL0a",
    preview: "Share final USDC quote please.",
    online: false,
    unread: 0,
    messages: [
      {
        id: "m4",
        sender: "me",
        text: "I can do 0.945 USDC per token.",
        time: "Yesterday",
        delivered: true,
        read: true,
      },
      { id: "m5", sender: "peer", text: "Share final USDC quote please.", time: "Yesterday" },
    ],
  },
  {
    id: "helios-otc",
    name: "Helios OTC",
    address: "Fk9P...t3Qw",
    preview: "Offer accepted. Sending escrow details.",
    online: true,
    unread: 1,
    messages: [
      { id: "m6", sender: "peer", text: "Offer accepted. Sending escrow details.", time: "11:28" },
    ],
  },
];
