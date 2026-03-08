#![deny(clippy::all)]
#![deny(missing_docs)]
//! Escrow program enabling OTC token listings backed by program-owned vaults,
//! with static progressive platform fees per purchase and a fixed quote mint.

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    declare_id, entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey,
    pubkey::Pubkey,
    system_program,
};
use spl_associated_token_account::get_associated_token_address;
use spl_token::state::{Account as TokenAccount, Mint};

declare_id!("36qxSd5YiBkhxegF4HXN5WwJkKXcrCYN1VX2xnGN5EWV");

entrypoint!(process_instruction);

/// Static platform fee configuration (1% = 100 bps).
pub const FEE_BPS: u16 = 100;

/// Treasury wallet that receives fees (its ATA for the quote mint receives fees).
pub const FEE_TREASURY: Pubkey = pubkey!("J1XL6m2BHPmzSW8PmjyKQnFnak7sCET5ZnJZNvoheeg3");

/// Fixed quote mint (Test USDC on Solana).
pub const QUOTE_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

/// Program entrypoint implementation.
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = EscrowInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::from(EscrowError::InvalidInstructionData))?;

    match instruction {
        EscrowInstruction::InitializeListing {
            listing_id,
            price_per_token,
            quantity,
            min_buy_amount,
            allow_partial,
        } => initialize_listing(
            program_id,
            accounts,
            listing_id,
            price_per_token,
            quantity,
            min_buy_amount,
            allow_partial,
        ),
        EscrowInstruction::DepositTokens => deposit_tokens(program_id, accounts),
        EscrowInstruction::Purchase { quantity } => purchase_tokens(program_id, accounts, quantity),
        EscrowInstruction::CancelListing => cancel_listing(program_id, accounts),
        EscrowInstruction::GetListingDetails { listing_id } => {
            get_listing_details(program_id, accounts, listing_id)
        }
        EscrowInstruction::InitiateOffer {
            offer_id,
            listing_id,
            price,
            amount,
            buyer,
            installmental,
        } => initiate_offer(
            program_id,
            accounts,
            offer_id,
            listing_id,
            price,
            amount,
            buyer,
            installmental,
        ),
        EscrowInstruction::GetOfferDetails { offer_id } => {
            get_offer_details(program_id, accounts, offer_id)
        }
        EscrowInstruction::PayOffer { offer_id, base_amount } => {
            pay_offer(program_id, accounts, offer_id, base_amount)
        }
        EscrowInstruction::CancelOffer { offer_id } => {
            cancel_offer(program_id, accounts, offer_id)
        }
    }
}

/// Instructions supported by the escrow program.
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum EscrowInstruction {
    /// Initialize a new listing. Expects the listing account to be already created and owned by this program.
    InitializeListing {
        /// External identifier supplied by the client (e.g. auto increment, timestamp).
        listing_id: u64,
        /// Price per base token in quote token units (see note below on decimals).
        price_per_token: u64,
        /// Total amount of base tokens available for sale.
        quantity: u64,
        /// Minimum amount a buyer must purchase per fill.
        min_buy_amount: u64,
        /// Whether the listing can be partially filled.
        allow_partial: bool,
    },
    /// Move seller tokens into the escrow vault, activating the listing.
    DepositTokens,
    /// Allow a buyer to take `quantity` tokens from the listing.
    Purchase {
        /// Number of base tokens to purchase.
        quantity: u64,
    },
    /// Seller cancels the listing, retrieving any remaining tokens.
    CancelListing,
    /// Retrieve and log listing details for a given listing id (read-only helper).
    GetListingDetails {
        /// External identifier supplied by the client.
        listing_id: u64,
    },
    /// Seller-defined temporary discount/negotiation offer tied to a listing.
    InitiateOffer {
        /// Unique offer identifier supplied by the client.
        offer_id: u64,
        /// Listing identifier this offer is tied to.
        listing_id: u64,
        /// Discounted price per token to offer.
        price: u64,
        /// Amount of base tokens covered by this offer.
        amount: u64,
        /// Target buyer wallet (optional semantics enforced off-chain).
        buyer: Pubkey,
        /// Whether payment is installment-based (true) or full (false).
        installmental: bool,
    },
    /// Retrieve details of a negotiated offer.
    GetOfferDetails {
        /// Identifier supplied when creating the offer.
        offer_id: u64,
    },
    /// Buyer settles a negotiated offer by paying quote tokens.
    PayOffer {
        /// Offer identifier being settled.
        offer_id: u64,
        /// Base token amount the buyer wants to take under this offer.
        base_amount: u64,
    },
    /// Seller cancels a previously created offer.
    CancelOffer {
        /// Offer identifier to cancel.
        offer_id: u64,
    },
}

/// Possible execution states of a listing.
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
pub enum ListingStatus {
    /// Listing metadata has been initialized, tokens not yet deposited.
    AwaitingDeposit = 0,
    /// Listing is live and can be purchased.
    Active = 1,
    /// Listing has been completely filled.
    Completed = 2,
    /// Listing was cancelled by the seller.
    Cancelled = 3,
}

impl ListingStatus {
    fn as_u8(self) -> u8 {
        self as u8
    }
    fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(ListingStatus::AwaitingDeposit),
            1 => Some(ListingStatus::Active),
            2 => Some(ListingStatus::Completed),
            3 => Some(ListingStatus::Cancelled),
            _ => None,
        }
    }
}

/// Persistent listing state stored on-chain.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct Listing {
    /// Seller wallet that initialized the listing.
    pub seller: Pubkey,
    /// Mint of the base asset being sold.
    pub base_mint: Pubkey,
    /// Mint of the quote asset expected from buyers (constant: QUOTE_MINT).
    pub quote_mint: Pubkey,
    /// PDA responsible for authorising vault transfers.
    pub vault_authority: Pubkey,
    /// Price per base token in quote units.
    pub price_per_token: u64,
    /// Total base tokens available (initial quantity).
    pub quantity: u64,
    /// Total base tokens already purchased.
    pub filled: u64,
    /// Arbitrary identifier supplied by client.
    pub listing_id: u64,
    /// Minimum amount that must be purchased in a single transaction.
    pub min_buy_amount: u64,
    /// Listing configuration flags stored as bitset.
    pub flags: u8,
    /// PDA bump used for vault authority derivation.
    pub vault_bump: u8,
    /// Current status.
    pub status: u8,
    /// Number of decimals for the base mint, captured at initialization.
    pub base_decimals: u8,
    /// Cumulative platform fee collected so far (in quote smallest units).
    pub total_collected_fee: u64,
}

impl Listing {
    /// Number of bytes required to store the listing.
    /// 4 * 32 (pubkeys) + 5 * 8 (u64s) + 4 * 1 (u8s) + 8 (u64 fee)
    pub const LEN: usize = 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 8;

    /// Whether partial fills are allowed.
    pub fn allow_partial(&self) -> bool {
        self.flags & 0b0000_0001 == 1
    }

    /// Convenience for remaining base tokens still available.
    pub fn remaining(&self) -> u64 {
        self.quantity.saturating_sub(self.filled)
    }

    /// Current status as enum.
    pub fn status(&self) -> ListingStatus {
        ListingStatus::from_u8(self.status).unwrap_or(ListingStatus::Cancelled)
    }

    /// Update status.
    pub fn set_status(&mut self, status: ListingStatus) {
        self.status = status.as_u8();
    }
}

/// Escrow program specific errors.
#[derive(Debug, Clone, Copy)]
pub enum EscrowError {
    /// Supplied instruction data could not be parsed.
    InvalidInstructionData = 0,
    /// Account data length was unexpected.
    AccountLengthMismatch = 1,
    /// Listing already initialised.
    AlreadyInitialized = 2,
    /// Caller does not match expected authority.
    IncorrectAuthority = 3,
    /// Listing not ready for this operation.
    InvalidListingStatus = 4,
    /// Math overflow or invalid quantity.
    AmountOverflow = 5,
    /// Provided accounts do not match expected mints.
    MintMismatch = 6,
    /// Not enough tokens remain to satisfy the purchase.
    InsufficientQuantity = 7,
    /// Partial fills are disabled.
    PartialFillDisabled = 8,
    /// Requested amount is below the listing minimum.
    BelowMinimumPurchase = 9,
    /// Listing identifier mismatch.
    ListingNotFound = 10,
    /// Offer account already initialised or not empty.
    OfferAccountInUse = 11,
    /// Listing cannot accept more offers because nothing remains.
    ListingSoldOut = 12,
    /// Offer identifier mismatch.
    OfferNotFound = 13,
    /// Offer no longer active / depleted.
    OfferInactive = 14,
    /// Caller not authorised to settle the offer.
    BuyerMismatch = 15,
}

impl From<EscrowError> for ProgramError {
    fn from(value: EscrowError) -> Self {
        ProgramError::Custom(value as u32)
    }
}

fn deserialize_listing<'a>(
    program_id: &Pubkey,
    listing_info: &'a AccountInfo,
) -> Result<Listing, ProgramError> {
    if listing_info.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    if listing_info.data_len() < Listing::LEN {
        return Err(ProgramError::from(EscrowError::AccountLengthMismatch));
    }
    Listing::try_from_slice(&listing_info.data.borrow())
        .map_err(|_| ProgramError::from(EscrowError::InvalidInstructionData))
}

fn serialize_listing(listing_info: &AccountInfo, listing: &Listing) -> ProgramResult {
    if listing_info.data_len() < Listing::LEN {
        return Err(ProgramError::from(EscrowError::AccountLengthMismatch));
    }
    listing
        .serialize(&mut &mut listing_info.data.borrow_mut()[..])
        .map_err(|_| ProgramError::from(EscrowError::InvalidInstructionData))
}

/// Arbitrary negotiated offer stored on-chain for messaging references.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug)]
pub struct Offer {
    /// Unique identifier for the offer.
    pub offer_id: u64,
    /// Listing id this offer belongs to.
    pub listing_id: u64,
    /// Discounted price to apply.
    pub price: u64,
    /// Amount of tokens allowed under this offer.
    pub amount: u64,
    /// Intended buyer wallet (0 = open offer).
    pub buyer: Pubkey,
    /// Seller wallet (redundant for quick lookups).
    pub seller: Pubkey,
    /// Offer active flag (1 active, 0 consumed/cancelled).
    pub status: u8,
    /// Whether the offer expects installment payments.
    pub installmental: u8,
}

impl Offer {
    /// Size of the serialized offer record.
    pub const LEN: usize = 8 + 8 + 8 + 8 + 32 + 32 + 1 + 1;
}

fn serialize_offer(offer_info: &AccountInfo, offer: &Offer) -> ProgramResult {
    if offer_info.data_len() < Offer::LEN {
        return Err(ProgramError::from(EscrowError::AccountLengthMismatch));
    }
    offer
        .serialize(&mut &mut offer_info.data.borrow_mut()[..])
        .map_err(|_| ProgramError::from(EscrowError::InvalidInstructionData))
}

fn deserialize_offer(program_id: &Pubkey, offer_info: &AccountInfo) -> Result<Offer, ProgramError> {
    if offer_info.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    if offer_info.data_len() < Offer::LEN {
        return Err(ProgramError::from(EscrowError::AccountLengthMismatch));
    }
    Offer::try_from_slice(&offer_info.data.borrow())
        .map_err(|_| ProgramError::from(EscrowError::InvalidInstructionData))
}

fn initiate_offer(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    offer_id: u64,
    listing_id: u64,
    price: u64,
    amount: u64,
    buyer: Pubkey,
    installmental: bool,
) -> ProgramResult {
    if price == 0 || amount == 0 {
        return Err(ProgramError::from(EscrowError::AmountOverflow));
    }
    let account_info_iter = &mut accounts.iter();
    let seller_info = next_account_info(account_info_iter)?;
    let listing_info = next_account_info(account_info_iter)?;
    let offer_info = next_account_info(account_info_iter)?;

    if !seller_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if offer_info.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    if offer_info.data_len() < Offer::LEN {
        return Err(ProgramError::from(EscrowError::AccountLengthMismatch));
    }
    if offer_info.data.borrow().iter().any(|b| *b != 0) {
        return Err(ProgramError::from(EscrowError::OfferAccountInUse));
    }

    let listing = deserialize_listing(program_id, listing_info)?;
    if listing.listing_id != listing_id {
        return Err(ProgramError::from(EscrowError::ListingNotFound));
    }
    if seller_info.key != &listing.seller {
        return Err(ProgramError::from(EscrowError::IncorrectAuthority));
    }
    if listing.status() != ListingStatus::Active {
        return Err(ProgramError::from(EscrowError::InvalidListingStatus));
    }
    let remaining = listing.remaining();
    if remaining == 0 {
        return Err(ProgramError::from(EscrowError::ListingSoldOut));
    }
    if amount > remaining {
        return Err(ProgramError::from(EscrowError::InsufficientQuantity));
    }

    let offer = Offer {
        offer_id,
        listing_id,
        price,
        amount,
        buyer,
        seller: listing.seller,
        status: 1,
        installmental: if installmental { 1 } else { 0 },
    };

    serialize_offer(offer_info, &offer)?;
    msg!(
        "offer_initiated: id={}, listing={}, price={}, amount={}, buyer={}, seller={}",
        offer_id,
        listing_id,
        price,
        amount,
        buyer,
        listing.seller
    );
    Ok(())
}

fn get_offer_details(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    offer_id: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let offer_info = next_account_info(account_info_iter)?;
    let offer = deserialize_offer(program_id, offer_info)?;
    if offer.offer_id != offer_id {
        return Err(ProgramError::from(EscrowError::OfferNotFound));
    }

    msg!(
        "offer_details: id={}, listing={}, price={}, amount={}, buyer={}, seller={}, status={}, installmental={}",
        offer.offer_id,
        offer.listing_id,
        offer.price,
        offer.amount,
        offer.buyer,
        offer.seller,
        offer.status,
        offer.installmental
    );
    Ok(())
}

fn pay_offer(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    offer_id: u64,
    base_amount: u64,
) -> ProgramResult {
    if base_amount == 0 {
        return Err(ProgramError::from(EscrowError::AmountOverflow));
    }

    let account_info_iter = &mut accounts.iter();
    let buyer_info = next_account_info(account_info_iter)?;
    let offer_info = next_account_info(account_info_iter)?;
    let listing_info = next_account_info(account_info_iter)?;
    let seller_quote_account_info = next_account_info(account_info_iter)?;
    let fee_recipient_quote_account_info = next_account_info(account_info_iter)?;
    let buyer_quote_account_info = next_account_info(account_info_iter)?;
    let buyer_base_account_info = next_account_info(account_info_iter)?;
    let vault_authority_info = next_account_info(account_info_iter)?;
    let vault_token_account_info = next_account_info(account_info_iter)?;
    let token_program_info = next_account_info(account_info_iter)?;

    if !buyer_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut offer = deserialize_offer(program_id, offer_info)?;
    if offer.offer_id != offer_id {
        return Err(ProgramError::from(EscrowError::OfferNotFound));
    }
    if offer.status == 0 || offer.amount == 0 {
        return Err(ProgramError::from(EscrowError::OfferInactive));
    }

    let mut listing = deserialize_listing(program_id, listing_info)?;
    if listing.listing_id != offer.listing_id {
        return Err(ProgramError::from(EscrowError::ListingNotFound));
    }
    if listing.status() != ListingStatus::Active {
        return Err(ProgramError::from(EscrowError::InvalidListingStatus));
    }

    if &offer.buyer != buyer_info.key {
        return Err(ProgramError::from(EscrowError::BuyerMismatch));
    }

    let remaining_listing = listing.remaining();
    if remaining_listing == 0 {
        return Err(ProgramError::from(EscrowError::ListingSoldOut));
    }

    // Convert quote amount back to base quantity using offer price (scaled by base decimals).
    let base_quantity = base_amount;

    if base_quantity > offer.amount {
        return Err(ProgramError::from(EscrowError::InsufficientQuantity));
    }
    if base_quantity > remaining_listing {
        return Err(ProgramError::from(EscrowError::InsufficientQuantity));
    }
    if offer.installmental == 0 && base_quantity != offer.amount {
        return Err(ProgramError::from(EscrowError::PartialFillDisabled));
    }

    let decimals_factor = 10u128
        .checked_pow(u32::from(listing.base_decimals))
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?;
    let quote_amount_u128 = mul_div_floor(
        u128::from(base_quantity),
        u128::from(offer.price),
        decimals_factor.max(1),
    )?;
    if quote_amount_u128 == 0 {
        return Err(ProgramError::from(EscrowError::AmountOverflow));
    }
    let quote_amount = u64::try_from(quote_amount_u128)
        .map_err(|_| ProgramError::from(EscrowError::AmountOverflow))?;

    // Validate token accounts similar to purchase flow.
    let seller_quote_account = TokenAccount::unpack(&seller_quote_account_info.data.borrow())?;
    assert_token_account_owner(&seller_quote_account, &offer.seller)?;
    assert_token_account_mint(&seller_quote_account, &listing.quote_mint)?;

    let fee_recipient_quote_account =
        TokenAccount::unpack(&fee_recipient_quote_account_info.data.borrow())?;
    assert_token_account_owner(&fee_recipient_quote_account, &FEE_TREASURY)?;
    assert_token_account_mint(&fee_recipient_quote_account, &listing.quote_mint)?;
    let expected_fee_ata = get_associated_token_address(&FEE_TREASURY, &listing.quote_mint);
    if fee_recipient_quote_account_info.key != &expected_fee_ata {
        return Err(ProgramError::InvalidAccountData);
    }

    let buyer_quote_account = TokenAccount::unpack(&buyer_quote_account_info.data.borrow())?;
    assert_token_account_owner(&buyer_quote_account, buyer_info.key)?;
    assert_token_account_mint(&buyer_quote_account, &listing.quote_mint)?;
    if buyer_quote_account.amount < quote_amount {
        return Err(ProgramError::InsufficientFunds);
    }

    let buyer_base_account = TokenAccount::unpack(&buyer_base_account_info.data.borrow())?;
    assert_token_account_owner(&buyer_base_account, buyer_info.key)?;
    assert_token_account_mint(&buyer_base_account, &listing.base_mint)?;

    let vault_token_account = TokenAccount::unpack(&vault_token_account_info.data.borrow())?;
    assert_token_account_owner(&vault_token_account, vault_authority_info.key)?;
    assert_token_account_mint(&vault_token_account, &listing.base_mint)?;
    if vault_token_account.amount < base_quantity {
        return Err(ProgramError::InsufficientFunds);
    }
    if vault_authority_info.key != &listing.vault_authority {
        return Err(ProgramError::from(EscrowError::IncorrectAuthority));
    }

    // Quote transfers: buyer -> seller (net) and buyer -> fee.
    let fee_amount_u128 = bps_of(u128::from(quote_amount), FEE_BPS)?;
    let fee_amount = u64::try_from(fee_amount_u128)
        .map_err(|_| ProgramError::from(EscrowError::AmountOverflow))?;
    let seller_amount = quote_amount
        .checked_sub(fee_amount)
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?;

    let transfer_to_seller_ix = spl_token::instruction::transfer(
        token_program_info.key,
        buyer_quote_account_info.key,
        seller_quote_account_info.key,
        buyer_info.key,
        &[],
        seller_amount,
    )?;
    invoke(
        &transfer_to_seller_ix,
        &[
            buyer_quote_account_info.clone(),
            seller_quote_account_info.clone(),
            buyer_info.clone(),
            token_program_info.clone(),
        ],
    )?;

    if fee_amount > 0 {
        let transfer_fee_ix = spl_token::instruction::transfer(
            token_program_info.key,
            buyer_quote_account_info.key,
            fee_recipient_quote_account_info.key,
            buyer_info.key,
            &[],
            fee_amount,
        )?;
        invoke(
            &transfer_fee_ix,
            &[
                buyer_quote_account_info.clone(),
                fee_recipient_quote_account_info.clone(),
                buyer_info.clone(),
                token_program_info.clone(),
            ],
        )?;
    }

    // Move base tokens from vault to buyer.
    let transfer_base_ix = spl_token::instruction::transfer(
        token_program_info.key,
        vault_token_account_info.key,
        buyer_base_account_info.key,
        vault_authority_info.key,
        &[],
        base_quantity,
    )?;
    let listing_id_bytes = listing.listing_id.to_le_bytes();
    let signer_seeds: &[&[u8]] = &[
        b"vault",
        listing.seller.as_ref(),
        listing_id_bytes.as_ref(),
        &[listing.vault_bump],
    ];
    invoke_signed(
        &transfer_base_ix,
        &[
            vault_token_account_info.clone(),
            buyer_base_account_info.clone(),
            vault_authority_info.clone(),
            token_program_info.clone(),
        ],
        &[signer_seeds],
    )?;

    // Update listing + offer state.
    offer.amount = offer.amount.saturating_sub(base_quantity);
    if offer.amount == 0 {
        offer.status = 0;
    }

    listing.filled = listing
        .filled
        .checked_add(base_quantity)
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?;
    listing.total_collected_fee = listing
        .total_collected_fee
        .checked_add(fee_amount)
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?;
    if listing.filled >= listing.quantity {
        listing.set_status(ListingStatus::Completed);
    }

    serialize_offer(offer_info, &offer)?;
    serialize_listing(listing_info, &listing)?;

    msg!(
        "offer_paid: offer_id={}, listing={}, base_qty={}, quote={}, fee={}, seller_amount={}, remaining_offer={}",
        offer.offer_id,
        listing.listing_id,
        base_quantity,
        quote_amount,
        fee_amount,
        seller_amount,
        offer.amount
    );

    Ok(())
}

fn cancel_offer(program_id: &Pubkey, accounts: &[AccountInfo], offer_id: u64) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let seller_info = next_account_info(account_info_iter)?;
    let offer_info = next_account_info(account_info_iter)?;

    if !seller_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut offer = deserialize_offer(program_id, offer_info)?;
    if offer.offer_id != offer_id {
        return Err(ProgramError::from(EscrowError::OfferNotFound));
    }
    if &offer.seller != seller_info.key {
        return Err(ProgramError::from(EscrowError::IncorrectAuthority));
    }

    offer.status = 0;
    serialize_offer(offer_info, &offer)?;
    msg!("offer_cancelled: id={}, seller={}", offer.offer_id, offer.seller);
    Ok(())
}

fn assert_token_account_owner(account: &TokenAccount, owner: &Pubkey) -> ProgramResult {
    if &account.owner != owner {
        return Err(ProgramError::from(EscrowError::IncorrectAuthority));
    }
    Ok(())
}

fn assert_token_account_mint(account: &TokenAccount, mint: &Pubkey) -> ProgramResult {
    if &account.mint != mint {
        return Err(ProgramError::from(EscrowError::MintMismatch));
    }
    Ok(())
}

fn mul_div_floor(a: u128, b: u128, d: u128) -> Result<u128, ProgramError> {
    let prod = a
        .checked_mul(b)
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?;
    Ok(prod
        .checked_div(d)
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?)
}

fn bps_of(amount: u128, bps: u16) -> Result<u128, ProgramError> {
    mul_div_floor(amount, bps as u128, 10_000u128)
}

fn initialize_listing(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    listing_id: u64,
    price_per_token: u64,
    quantity: u64,
    min_buy_amount: u64,
    allow_partial: bool,
) -> ProgramResult {
    if quantity == 0 || price_per_token == 0 || min_buy_amount == 0 {
        return Err(ProgramError::from(EscrowError::AmountOverflow));
    }
    if min_buy_amount > quantity {
        return Err(ProgramError::from(EscrowError::BelowMinimumPurchase));
    }

    let account_info_iter = &mut accounts.iter();
    let seller_info = next_account_info(account_info_iter)?;
    let listing_info = next_account_info(account_info_iter)?;
    let vault_authority_info = next_account_info(account_info_iter)?;
    let vault_token_account_info = next_account_info(account_info_iter)?;
    let base_mint_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    if !seller_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if listing_info.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    if listing_info.data.borrow().iter().any(|b| *b != 0) {
        return Err(ProgramError::from(EscrowError::AlreadyInitialized));
    }

    if system_program_info.key != &system_program::ID {
        return Err(ProgramError::IncorrectProgramId);
    }

    let listing_id_bytes = listing_id.to_le_bytes();
    let seeds: [&[u8]; 3] = [
        b"vault",
        seller_info.key.as_ref(),
        listing_id_bytes.as_ref(),
    ];
    let (expected_vault_authority, bump) = Pubkey::find_program_address(&seeds, program_id);
    if vault_authority_info.key != &expected_vault_authority {
        return Err(ProgramError::from(EscrowError::IncorrectAuthority));
    }

    let expected_vault_ata =
        get_associated_token_address(vault_authority_info.key, base_mint_info.key);
    if vault_token_account_info.key != &expected_vault_ata {
        return Err(ProgramError::from(EscrowError::MintMismatch));
    }

    // Validate base mint (we store decimals). Quote mint is fixed constant.
    let base_mint = Mint::unpack(&base_mint_info.data.borrow())?;

    let flags = if allow_partial { 1 } else { 0 };

    let listing = Listing {
        seller: *seller_info.key,
        base_mint: *base_mint_info.key,
        quote_mint: QUOTE_MINT,
        vault_authority: *vault_authority_info.key,
        price_per_token,
        quantity,
        filled: 0,
        listing_id,
        min_buy_amount,
        flags,
        vault_bump: bump,
        status: ListingStatus::AwaitingDeposit.as_u8(),
        base_decimals: base_mint.decimals,
        total_collected_fee: 0,
    };

    msg!(
        "listing_initialized: id={}, price={}, qty={}, min_buy={}, fee_bps={}, quote_mint={}",
        listing_id,
        price_per_token,
        quantity,
        min_buy_amount,
        FEE_BPS,
        QUOTE_MINT
    );

    serialize_listing(listing_info, &listing)
}

fn deposit_tokens(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let seller_info = next_account_info(account_info_iter)?;
    let listing_info = next_account_info(account_info_iter)?;
    let seller_token_account_info = next_account_info(account_info_iter)?;
    let vault_authority_info = next_account_info(account_info_iter)?;
    let vault_token_account_info = next_account_info(account_info_iter)?;
    let token_program_info = next_account_info(account_info_iter)?;

    if !seller_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut listing = deserialize_listing(program_id, listing_info)?;

    if listing.status() != ListingStatus::AwaitingDeposit {
        return Err(ProgramError::from(EscrowError::InvalidListingStatus));
    }
    if seller_info.key != &listing.seller {
        return Err(ProgramError::from(EscrowError::IncorrectAuthority));
    }

    let seller_token_account = TokenAccount::unpack(&seller_token_account_info.data.borrow())?;
    assert_token_account_owner(&seller_token_account, seller_info.key)?;
    assert_token_account_mint(&seller_token_account, &listing.base_mint)?;

    let vault_token_account = TokenAccount::unpack(&vault_token_account_info.data.borrow())?;
    assert_token_account_owner(&vault_token_account, vault_authority_info.key)?;
    assert_token_account_mint(&vault_token_account, &listing.base_mint)?;

    if vault_authority_info.key != &listing.vault_authority {
        return Err(ProgramError::from(EscrowError::IncorrectAuthority));
    }

    let amount = listing.quantity;
    if seller_token_account.amount < amount {
        return Err(ProgramError::InsufficientFunds);
    }

    let ix = spl_token::instruction::transfer(
        token_program_info.key,
        seller_token_account_info.key,
        vault_token_account_info.key,
        seller_info.key,
        &[],
        amount,
    )?;

    invoke(
        &ix,
        &[
            seller_token_account_info.clone(),
            vault_token_account_info.clone(),
            seller_info.clone(),
            token_program_info.clone(),
        ],
    )?;

    listing.set_status(ListingStatus::Active);
    msg!(
        "deposit: id={}, qty_deposited={}",
        listing.listing_id,
        amount
    );
    serialize_listing(listing_info, &listing)
}

fn purchase_tokens(_program_id: &Pubkey, accounts: &[AccountInfo], quantity: u64) -> ProgramResult {
    if quantity == 0 {
        return Err(ProgramError::from(EscrowError::AmountOverflow));
    }

    let account_info_iter = &mut accounts.iter();
    let buyer_info = next_account_info(account_info_iter)?;
    let listing_info = next_account_info(account_info_iter)?;
    let seller_quote_account_info = next_account_info(account_info_iter)?;
    let fee_recipient_quote_account_info = next_account_info(account_info_iter)?;
    let buyer_quote_account_info = next_account_info(account_info_iter)?;
    let buyer_base_account_info = next_account_info(account_info_iter)?;
    let vault_authority_info = next_account_info(account_info_iter)?;
    let vault_token_account_info = next_account_info(account_info_iter)?;
    let token_program_info = next_account_info(account_info_iter)?;

    if !buyer_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut listing = deserialize_listing(listing_info.owner, listing_info)?;
    if listing.status() != ListingStatus::Active {
        return Err(ProgramError::from(EscrowError::InvalidListingStatus));
    }

    if vault_authority_info.key != &listing.vault_authority {
        return Err(ProgramError::from(EscrowError::IncorrectAuthority));
    }

    let remaining = listing.remaining();
    if quantity > remaining {
        return Err(ProgramError::from(EscrowError::InsufficientQuantity));
    }
    if quantity < remaining && !listing.allow_partial() {
        return Err(ProgramError::from(EscrowError::PartialFillDisabled));
    }
    if remaining > listing.min_buy_amount {
        if quantity < listing.min_buy_amount {
            return Err(ProgramError::from(EscrowError::BelowMinimumPurchase));
        }
    } else if quantity != remaining {
        return Err(ProgramError::from(EscrowError::BelowMinimumPurchase));
    }

    // Price math: quote_amount = (quantity * price_per_token) / 10^base_decimals (floor)
    let decimals_factor = 10u128
        .checked_pow(u32::from(listing.base_decimals))
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?;
    let quote_amount_u128 = mul_div_floor(
        u128::from(quantity),
        u128::from(listing.price_per_token),
        decimals_factor.max(1),
    )?;
    if quote_amount_u128 == 0 {
        return Err(ProgramError::from(EscrowError::AmountOverflow));
    }
    let quote_amount = u64::try_from(quote_amount_u128)
        .map_err(|_| ProgramError::from(EscrowError::AmountOverflow))?;

    // Validate token accounts (quote mint is fixed constant)
    let seller_quote_account = TokenAccount::unpack(&seller_quote_account_info.data.borrow())?;
    assert_token_account_owner(&seller_quote_account, &listing.seller)?;
    assert_token_account_mint(&seller_quote_account, &listing.quote_mint)?;

    let buyer_quote_account = TokenAccount::unpack(&buyer_quote_account_info.data.borrow())?;
    assert_token_account_owner(&buyer_quote_account, buyer_info.key)?;
    assert_token_account_mint(&buyer_quote_account, &listing.quote_mint)?;
    if buyer_quote_account.amount < quote_amount {
        return Err(ProgramError::InsufficientFunds);
    }

    let buyer_base_account = TokenAccount::unpack(&buyer_base_account_info.data.borrow())?;
    assert_token_account_owner(&buyer_base_account, buyer_info.key)?;
    assert_token_account_mint(&buyer_base_account, &listing.base_mint)?;

    let vault_token_account = TokenAccount::unpack(&vault_token_account_info.data.borrow())?;
    assert_token_account_owner(&vault_token_account, vault_authority_info.key)?;
    assert_token_account_mint(&vault_token_account, &listing.base_mint)?;
    if vault_token_account.amount < quantity {
        return Err(ProgramError::InsufficientFunds);
    }

    // Validate fee recipient ATA is expected (treasury, quote mint)
    let expected_fee_ata = get_associated_token_address(&FEE_TREASURY, &listing.quote_mint);
    if fee_recipient_quote_account_info.key != &expected_fee_ata {
        return Err(ProgramError::InvalidAccountData);
    }
    let fee_recipient_quote_account =
        TokenAccount::unpack(&fee_recipient_quote_account_info.data.borrow())?;
    assert_token_account_owner(&fee_recipient_quote_account, &FEE_TREASURY)?;
    assert_token_account_mint(&fee_recipient_quote_account, &listing.quote_mint)?;

    // --- Fee math (all in quote smallest units) ---
    let total_price_this_tx = u128::from(quote_amount);
    let nominal_fee_this_tx = bps_of(total_price_this_tx, FEE_BPS)?;

    // Cap across listing lifetime
    let full_value = mul_div_floor(
        u128::from(listing.quantity),
        u128::from(listing.price_per_token),
        decimals_factor.max(1),
    )?;
    let total_fee_cap = bps_of(full_value, FEE_BPS)?;
    let headroom = total_fee_cap.saturating_sub(u128::from(listing.total_collected_fee));

    let fee_this_tx_u128 = nominal_fee_this_tx.min(headroom);
    let seller_amount_u128 = total_price_this_tx
        .checked_sub(fee_this_tx_u128)
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?;

    let fee_this_tx = u64::try_from(fee_this_tx_u128)
        .map_err(|_| ProgramError::from(EscrowError::AmountOverflow))?;
    let seller_amount = u64::try_from(seller_amount_u128)
        .map_err(|_| ProgramError::from(EscrowError::AmountOverflow))?;

    // Transfer quote tokens: Buyer → Seller
    if seller_amount > 0 {
        let transfer_quote_to_seller_ix = spl_token::instruction::transfer(
            token_program_info.key,
            buyer_quote_account_info.key,
            seller_quote_account_info.key,
            buyer_info.key,
            &[],
            seller_amount,
        )?;
        invoke(
            &transfer_quote_to_seller_ix,
            &[
                buyer_quote_account_info.clone(),
                seller_quote_account_info.clone(),
                buyer_info.clone(),
                token_program_info.clone(),
            ],
        )?;
    }

    // Transfer quote tokens: Buyer → Fee Treasury (if any)
    if fee_this_tx > 0 {
        let transfer_quote_fee_ix = spl_token::instruction::transfer(
            token_program_info.key,
            buyer_quote_account_info.key,
            fee_recipient_quote_account_info.key,
            buyer_info.key,
            &[],
            fee_this_tx,
        )?;
        invoke(
            &transfer_quote_fee_ix,
            &[
                buyer_quote_account_info.clone(),
                fee_recipient_quote_account_info.clone(),
                buyer_info.clone(),
                token_program_info.clone(),
            ],
        )?;
    }

    // Transfer base tokens from vault to buyer
    let transfer_base_ix = spl_token::instruction::transfer(
        token_program_info.key,
        vault_token_account_info.key,
        buyer_base_account_info.key,
        vault_authority_info.key,
        &[],
        quantity,
    )?;
    let listing_id_bytes = listing.listing_id.to_le_bytes();
    let bump_seed = [listing.vault_bump];
    let signer_seeds: &[&[u8]] = &[
        b"vault",
        listing.seller.as_ref(),
        listing_id_bytes.as_ref(),
        &bump_seed,
    ];

    invoke_signed(
        &transfer_base_ix,
        &[
            vault_token_account_info.clone(),
            buyer_base_account_info.clone(),
            vault_authority_info.clone(),
            token_program_info.clone(),
        ],
        &[signer_seeds],
    )?;

    // Update accounting
    listing.filled = listing
        .filled
        .checked_add(quantity)
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?;
    listing.total_collected_fee = listing
        .total_collected_fee
        .checked_add(fee_this_tx)
        .ok_or(ProgramError::from(EscrowError::AmountOverflow))?;

    if listing.filled >= listing.quantity {
        listing.set_status(ListingStatus::Completed);
    }

    msg!(
        "purchase: id={}, qty={}, price={}, fee={}, seller_amount={}, fee_collected_total={}",
        listing.listing_id,
        quantity,
        quote_amount,
        fee_this_tx,
        seller_amount,
        listing.total_collected_fee
    );

    serialize_listing(listing_info, &listing)
}

fn get_listing_details(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    listing_id: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let listing_info = next_account_info(account_info_iter)?;
    let listing = deserialize_listing(program_id, listing_info)?;
    if listing.listing_id != listing_id {
        return Err(ProgramError::from(EscrowError::ListingNotFound));
    }

    msg!(
        "listing_details: id={}, seller={}, base_mint={}, quote_mint={}, price_per_token={}, remaining={}, min_buy={}, allow_partial={}, status={:?}",
        listing.listing_id,
        listing.seller,
        listing.base_mint,
        listing.quote_mint,
        listing.price_per_token,
        listing.remaining(),
        listing.min_buy_amount,
        listing.allow_partial(),
        listing.status()
    );
    Ok(())
}

fn cancel_listing(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let seller_info = next_account_info(account_info_iter)?;
    let listing_info = next_account_info(account_info_iter)?;
    let vault_authority_info = next_account_info(account_info_iter)?;
    let vault_token_account_info = next_account_info(account_info_iter)?;
    let seller_token_account_info = next_account_info(account_info_iter)?;
    let token_program_info = next_account_info(account_info_iter)?;

    if !seller_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut listing = deserialize_listing(program_id, listing_info)?;

    if &listing.seller != seller_info.key {
        return Err(ProgramError::from(EscrowError::IncorrectAuthority));
    }

    match listing.status() {
        ListingStatus::AwaitingDeposit => {
            listing.set_status(ListingStatus::Cancelled);
            msg!(
                "cancel: id={}, status=AwaitingDeposit→Cancelled",
                listing.listing_id
            );
            return serialize_listing(listing_info, &listing);
        }
        ListingStatus::Active => {}
        _ => return Err(ProgramError::from(EscrowError::InvalidListingStatus)),
    }

    let remaining = listing.remaining();
    if remaining > 0 {
        let vault_token_account = TokenAccount::unpack(&vault_token_account_info.data.borrow())?;
        assert_token_account_owner(&vault_token_account, vault_authority_info.key)?;
        assert_token_account_mint(&vault_token_account, &listing.base_mint)?;

        let seller_base_account = TokenAccount::unpack(&seller_token_account_info.data.borrow())?;
        assert_token_account_owner(&seller_base_account, seller_info.key)?;
        assert_token_account_mint(&seller_base_account, &listing.base_mint)?;

        let transfer_ix = spl_token::instruction::transfer(
            token_program_info.key,
            vault_token_account_info.key,
            seller_token_account_info.key,
            vault_authority_info.key,
            &[],
            remaining,
        )?;
        let listing_id_bytes = listing.listing_id.to_le_bytes();
        let bump_seed = [listing.vault_bump];
        let signer_seeds: &[&[u8]] = &[
            b"vault",
            listing.seller.as_ref(),
            listing_id_bytes.as_ref(),
            &bump_seed,
        ];

        invoke_signed(
            &transfer_ix,
            &[
                vault_token_account_info.clone(),
                seller_token_account_info.clone(),
                vault_authority_info.clone(),
                token_program_info.clone(),
            ],
            &[signer_seeds],
        )?;
    }

    listing.set_status(ListingStatus::Cancelled);
    msg!(
        "cancel: id={}, remaining_refunded={}",
        listing.listing_id,
        remaining
    );
    serialize_listing(listing_info, &listing)
}
