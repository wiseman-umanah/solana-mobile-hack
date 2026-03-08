# Backend Overview

This directory hosts the Node.js backend that powers authentication, messaging, reviews, and Solana OTC listing coordination for the app. It exposes a REST API, a Socket.IO gateway for realtime chat, and MongoDB persistence for users, nonces, conversations, reviews, and listing activity.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 20+ | Matches the version used by the repo toolchain. |
| pnpm 9/10   | Listed in `packageManager`; use pnpm for installs and scripts. |
| MongoDB     | The app expects a running Mongo instance accessible via `DB_URI` or `MONGO_URI`. |
| Solana CLI (optional) | Only needed if you mirror on-chain activity locally. |

Copy `backend/.env.example` (if provided) or define the required environment variables:

```
DB_URI=mongodb://localhost:27017/otc
JWT_SECRET=replace_me
FRONTEND_ORIGIN=http://localhost:5173
PORT=5000
```

`DB_URI` (or `MONGO_URI`) is mandatory; without it the server will refuse to start.

## Install & Run

```bash
cd backend
pnpm install
pnpm start          # runs `node server.js`
# or pnpm dev if you add nodemon
```

The API listens on `PORT` (defaults to 5000) and automatically wires Socket.IO on the same HTTP server.

## Project Structure

```
backend/
├── server.js                # Express + Socket.IO entrypoint
├── package.json / pnpm-lock.yaml
├── src/
│   ├── middleware/
│   │   └── authMiddleware.js    # JWT verification for protected REST routes
│   ├── models/
│   │   ├── listingActivity.js   # CREATE/PURCHASE/DISCOUNT activity records
│   │   ├── message.js           # Chat payloads stored for conversations
│   │   ├── nonce.js             # Wallet nonce used for signature-based login
│   │   ├── review.js            # Listing reviews + ratings
│   │   ├── refreshToken.js      # Optional refresh-token storage
│   │   └── user.js              # Wallet-centric user profile
│   ├── routes/
│   │   ├── auth.js              # Nonce issuance, signature verification, JWT
│   │   ├── listings.js          # Activity logging/fetching for listings
│   │   ├── messages.js          # REST endpoints for conversations + messages
│   │   ├── reviews.js           # CRUD for listing reviews
│   │   └── users.js             # Username/profile updates
│   └── utils/
│       └── verifySignature.js   # Ed25519 signature helper for wallet auth
└── pnpm-workspace.yaml          # Allows this folder to be part of the monorepo workspace
```

### Entry Point (`server.js`)

* Loads `.env`.
* Connects to MongoDB via Mongoose.
* Sets up Express middleware (`cors`, JSON parsing).
* Mounts REST routes:
  - `/auth/*` for nonce issuance and signature verification.
  - `/api/messages` & `/api/conversations` for authenticated chat history.
  - `/api/reviews` for listing feedback.
  - `/api/listings` for user-specific listing activity (CREATE, PURCHASE, DISCOUNT events).
  - `/api/users` for profile edits (username, etc.).
* Registers Socket.IO with JWT-based auth. Key events:
  - `sendMessage`: persists message and emits to receiver + sender.
  - `messageRead`, `messageDelivered`: status updates.
  - `presence`: simple online/offline broadcast.
* Express fallbacks keep legacy `/messages` endpoints available for compatibility.

### Data Flow Summary

1. **Auth**: Wallet requests `/auth/nonce`, signs it, and posts signature to `/auth/verify`. The backend verifies via `@solana/web3.js` (see `verifySignature.js`), then issues JWT access tokens (and refresh tokens if enabled).
2. **Messaging**: Authenticated clients fetch conversations via REST, but push/receive realtime messages over Socket.IO (`sendMessage`, `newMessage` events). Messages are saved in Mongo (`Message` model).
3. **Listings Activity**: When the frontend logs a CREATE/PURCHASE/DISCOUNT event, it POSTs to `/api/listings/activity`, which stores normalized records in `ListingActivity`. Dashboard/Profile fetches limited subsets for recent activity.
4. **Reviews**: `reviews.js` exposes GET/POST endpoints per listing. Aggregations compute average rating for SEO/UX.
5. **Users**: `users.js` lets authenticated wallets attach a username or update simple profile data.

## Development Notes

* **JWT middleware**: Any route mounted under `/api` runs through `src/middleware/authMiddleware.js`. The middleware decodes the JWT, attaches `req.user.walletAddress`, and rejects unauthenticated requests.
* **Socket authentication**: Socket.IO clients pass `auth: { token }`; the same JWT verification is reused for realtime events, enabling room-based routing (wallet address is the room ID).
* **Error handling**: Routes aim to return `{ success: false, error }` on failures; server logs are emitted via `console.error` for ease of debugging.
* **Signature verification**: `verifySignature.js` converts base58 signatures to bytes and validates them with `tweetnacl`. Always ensure the `nonce` document is consumed (it’s a single-use challenge).

## Extending the Backend

* Add new REST modules under `src/routes/*` and mount them in `server.js`. Protect sensitive endpoints with `authMiddleware`.
* For new Mongo collections, define the schema in `src/models`, then import inside the relevant routes/controllers.


## Testing & Tooling

Formal tests aren’t provided, but you can exercise the backend via:

* `pnpm start` + Postman/Insomnia for REST.
* `pnpm start` + `wscat` or the frontend for Socket.IO.
* Mongo inspector (Compass) to verify documents.


