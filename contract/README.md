# Escrow Program

This workspace contains the on-chain Solana program that secures OTC token listings by holding seller assets in a PDA-controlled vault and mediating swaps.

## Structure
- `Cargo.toml` – workspace definition (Solana 1.18.x, Rust 2024 edition)
- `src/` – program source base


## Prerequisites
- Solana CLI 1.18.x [solana docs](https://docs.solana.com/cli/install-solana-cli-tools)
- Rust stable toolchain


## Build
Build the SBF shared object that will be deployed on-chain:
```
cargo build-sbf
```
Artifacts land in `target/deploy/<file>.so` and `target/deploy/<file>-keypair.json`.

## Deploy
1. Configure your CLI to the target cluster (e.g. devnet):
   ```
   solana config set --url https://api.devnet.solana.com
   ```
2. Deploy the program:
   ```
   solana program deploy target/deploy/<file>.so
   ```
3. Record the resulting program id. Update the frontend environment (`VITE_ESCROW_PROGRAM_ID`) and any other services that reference it.

## Program interface
- **InitializeListing**
  - Accounts: seller, listing account (PDA owned), vault authority PDA, vault ATA, base mint, quote mint, system program
  - Writes listing metadata (`Listing` struct).
- **DepositTokens**
  - Moves seller base tokens into the vault ATA.
- **Purchase**
  - Transfers quote tokens from buyer to seller,
  - Transfers base tokens from vault to buyer using the PDA signer seeds,
  - Updates the filled amount and status.
- **GetListingDetails**
  - Retrieves listing metadata (`Listing` struct).
- **CancelListing**
  - Seller cancels the listing, retrieving any remaining tokens.
- **InitiateOffer**
  - Initiate a discounted offer for a specific buyer (frontend - chat flow) with details like installmental buy all or all at once buy.
- **GetOfferDetails**
  - Retrieves Offer metadata.
- **CancelOffer**
  - Seller cancels the offer. offer becomes invalid for buyer to pay for.
- **PayOffer**
  - Transfers quote tokens from buyer to seller (at discounted price),
  - Transfers base tokens from vault to buyer using the PDA signer seeds,
  - Updates the filled amount and status of listing.
  
-----------------------------------------------------

## Best Deployment Strategy
It is best to build and deploy in solana playground

check playground here: [solana playground](https://beta.solpg.io/)

Copy Code, Build program and Deploy
Use Test Account there or connect wallet

Obtain the program Id to be used in frontend.

