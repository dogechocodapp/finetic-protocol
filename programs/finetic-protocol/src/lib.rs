use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("3vhsPAwd9XFBidzPBxZfyrHKrF1G12qMuyaM6fwVbC8Q");

#[program]
pub mod finetic_protocol {
    use super::*;

    /// Initialize the protocol with admin and fee wallet
    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol_state;
        protocol.admin = ctx.accounts.admin.key();
        protocol.fee_wallet = ctx.accounts.fee_wallet.key();
        protocol.insurance_wallet = ctx.accounts.insurance_wallet.key();
        protocol.total_loans = 0;
        protocol.total_volume = 0;
        protocol.total_fees_collected = 0;
        protocol.bump = bump;
        protocol.is_paused = false;
        Ok(())
    }

    /// Lender creates a loan offer
    pub fn create_offer(
        ctx: Context<CreateOffer>,
        offer_id: u64,
        amount: u64,
        interest_tier: u8,
        term_months: u8,
        min_amount: u64,
    ) -> Result<()> {
        require!(interest_tier <= 1, FineticError::InvalidTier);
        require!(term_months == 12 || term_months == 24, FineticError::InvalidTerm);
        require!(amount > 0, FineticError::InvalidAmount);

        let offer = &mut ctx.accounts.offer;
        offer.offer_id = offer_id;
        offer.lender = ctx.accounts.lender.key();
        offer.stable_mint = ctx.accounts.stable_mint.key();
        offer.amount = amount;
        offer.min_amount = min_amount;
        offer.interest_tier = interest_tier;
        offer.term_months = term_months;
        offer.is_active = true;
        offer.created_at = Clock::get()?.unix_timestamp;
        offer.bump = ctx.bumps.offer;

        emit!(OfferCreated {
            offer_id,
            lender: ctx.accounts.lender.key(),
            amount,
            interest_tier,
            term_months,
        });

        Ok(())
    }

    /// Cancel an active offer (only lender)
    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        let offer = &mut ctx.accounts.offer;
        require!(offer.is_active, FineticError::OfferNotActive);
        require!(offer.lender == ctx.accounts.lender.key(), FineticError::Unauthorized);

        offer.is_active = false;

        emit!(OfferCancelled {
            offer_id: offer.offer_id,
            lender: ctx.accounts.lender.key(),
        });

        Ok(())
    }

    /// Borrower accepts offer: deposits collateral, lender funds loan
    pub fn execute_loan(
        ctx: Context<ExecuteLoan>,
        loan_id: u64,
        collateral_amount: u64,
        loan_amount: u64,
    ) -> Result<()> {
        let offer = &mut ctx.accounts.offer;
        let protocol = &ctx.accounts.protocol_state;

        require!(!protocol.is_paused, FineticError::ProtocolPaused);
        require!(offer.is_active, FineticError::OfferNotActive);
        require!(loan_amount <= offer.amount, FineticError::ExceedsOffer);
        require!(loan_amount >= offer.min_amount, FineticError::BelowMinimum);

        // Calculate fees based on tier
        let (origination_bps, interest_fee_bps) = match offer.interest_tier {
            0 => (150u64, 150u64),
            1 => (200u64, 200u64),
            _ => return Err(FineticError::InvalidTier.into()),
        };

        let origination_fee = loan_amount
            .checked_mul(origination_bps)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        let insurance_reserve = loan_amount
            .checked_mul(50)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        let amount_to_borrower = loan_amount
            .checked_sub(origination_fee)
            .unwrap();

        // 1. Transfer collateral from borrower to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.borrower_collateral_account.to_account_info(),
                    to: ctx.accounts.escrow_collateral_account.to_account_info(),
                    authority: ctx.accounts.borrower.to_account_info(),
                },
            ),
            collateral_amount,
        )?;

        // 2. Transfer loan from lender to borrower (minus origination fee)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.lender_stable_account.to_account_info(),
                    to: ctx.accounts.borrower_stable_account.to_account_info(),
                    authority: ctx.accounts.lender.to_account_info(),
                },
            ),
            amount_to_borrower,
        )?;

        // 3. Transfer origination fee to Finetic fee wallet
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.lender_stable_account.to_account_info(),
                    to: ctx.accounts.fee_account.to_account_info(),
                    authority: ctx.accounts.lender.to_account_info(),
                },
            ),
            origination_fee,
        )?;

        // Initialize loan state
        let loan = &mut ctx.accounts.loan;
        let now = Clock::get()?.unix_timestamp;
        let term_seconds = (offer.term_months as i64) * 30 * 24 * 60 * 60;

        loan.loan_id = loan_id;
        loan.offer_id = offer.offer_id;
        loan.lender = offer.lender;
        loan.borrower = ctx.accounts.borrower.key();
        loan.stable_mint = offer.stable_mint;
        loan.collateral_mint = ctx.accounts.collateral_mint.key();
        loan.loan_amount = loan_amount;
        loan.collateral_amount = collateral_amount;
        loan.interest_tier = offer.interest_tier;
        loan.interest_fee_bps = interest_fee_bps;
        loan.origination_fee = origination_fee;
        loan.insurance_reserve = insurance_reserve;
        loan.term_months = offer.term_months;
        loan.started_at = now;
        loan.matures_at = now + term_seconds;
        loan.status = LoanStatus::Active;
        loan.referral_platform = Pubkey::default();
        loan.bump = ctx.bumps.loan;

        // Mark offer as matched (or reduce remaining amount)
        if loan_amount == offer.amount {
            offer.is_active = false;
        } else {
            offer.amount = offer.amount.checked_sub(loan_amount).unwrap();
        }

        // Update protocol stats
        let protocol_state = &mut ctx.accounts.protocol_state;
        protocol_state.total_loans += 1;
        protocol_state.total_volume += loan_amount;
        protocol_state.total_fees_collected += origination_fee;

        emit!(LoanExecuted {
            loan_id,
            offer_id: offer.offer_id,
            lender: offer.lender,
            borrower: ctx.accounts.borrower.key(),
            loan_amount,
            collateral_amount,
            interest_tier: offer.interest_tier,
            matures_at: loan.matures_at,
        });

        Ok(())
    }

    /// Borrower repays loan: gets collateral back
    pub fn repay_loan(ctx: Context<RepayLoan>) -> Result<()> {
        let loan = &mut ctx.accounts.loan;
        let now = Clock::get()?.unix_timestamp;

        require!(loan.status == LoanStatus::Active, FineticError::LoanNotActive);
        require!(loan.borrower == ctx.accounts.borrower.key(), FineticError::Unauthorized);
        require!(now <= loan.matures_at, FineticError::LoanExpired);

        // Calculate interest owed
        let interest_rate = match loan.interest_tier {
            0 => 1000u64,
            1 => 2000u64,
            _ => return Err(FineticError::InvalidTier.into()),
        };

        let elapsed_seconds = (now - loan.started_at) as u64;
        let year_seconds = 365u64 * 24 * 60 * 60;

        let interest_owed = loan.loan_amount
            .checked_mul(interest_rate)
            .unwrap()
            .checked_mul(elapsed_seconds)
            .unwrap()
            .checked_div(10000u64.checked_mul(year_seconds).unwrap())
            .unwrap();

        let platform_interest_fee = interest_owed
            .checked_mul(loan.interest_fee_bps)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        let interest_to_lender = interest_owed
            .checked_sub(platform_interest_fee)
            .unwrap();

        let total_repayment = loan.loan_amount
            .checked_add(interest_to_lender)
            .unwrap();

        // 1. Borrower repays principal + interest to lender
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.borrower_stable_account.to_account_info(),
                    to: ctx.accounts.lender_stable_account.to_account_info(),
                    authority: ctx.accounts.borrower.to_account_info(),
                },
            ),
            total_repayment,
        )?;

        // 2. Platform interest fee to Finetic
        if platform_interest_fee > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.borrower_stable_account.to_account_info(),
                        to: ctx.accounts.fee_account.to_account_info(),
                        authority: ctx.accounts.borrower.to_account_info(),
                    },
                ),
                platform_interest_fee,
            )?;
        }

        // 3. Release collateral back to borrower
        let loan_id_bytes = loan.loan_id.to_le_bytes();
        let seeds = &[
            b"loan",
            loan_id_bytes.as_ref(),
            &[loan.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_collateral_account.to_account_info(),
                    to: ctx.accounts.borrower_collateral_account.to_account_info(),
                    authority: loan.to_account_info(),
                },
                signer_seeds,
            ),
            loan.collateral_amount,
        )?;

        let term_seconds = (loan.term_months as i64) * 30 * 24 * 60 * 60;
        let half_term = loan.started_at + (term_seconds / 2);

        loan.status = if now < half_term {
            LoanStatus::RepaidEarly50
        } else if now < loan.matures_at {
            LoanStatus::RepaidEarly
        } else {
            LoanStatus::RepaidOnTime
        };

        loan.repaid_at = now;

        emit!(LoanRepaid {
            loan_id: loan.loan_id,
            borrower: ctx.accounts.borrower.key(),
            lender: loan.lender,
            total_repaid: total_repayment + platform_interest_fee,
            interest_paid: interest_owed,
            platform_fee: platform_interest_fee,
            status: loan.status,
        });

        Ok(())
    }

    /// Lender claims collateral after maturity (default)
    pub fn claim_default(ctx: Context<ClaimDefault>) -> Result<()> {
        let loan = &mut ctx.accounts.loan;
        let now = Clock::get()?.unix_timestamp;

        require!(loan.status == LoanStatus::Active, FineticError::LoanNotActive);
        require!(loan.lender == ctx.accounts.lender.key(), FineticError::Unauthorized);
        require!(now > loan.matures_at, FineticError::LoanNotExpired);

        let loan_id_bytes = loan.loan_id.to_le_bytes();
        let seeds = &[
            b"loan",
            loan_id_bytes.as_ref(),
            &[loan.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_collateral_account.to_account_info(),
                    to: ctx.accounts.lender_collateral_account.to_account_info(),
                    authority: loan.to_account_info(),
                },
                signer_seeds,
            ),
            loan.collateral_amount,
        )?;

        loan.status = LoanStatus::Defaulted;

        emit!(LoanDefaulted {
            loan_id: loan.loan_id,
            lender: ctx.accounts.lender.key(),
            borrower: loan.borrower,
            collateral_amount: loan.collateral_amount,
            insurance_reserve: loan.insurance_reserve,
        });

        Ok(())
    }

    /// Both parties agree to renew — new term, interest doubles
    pub fn renew_loan(
        ctx: Context<RenewLoan>,
        new_loan_id: u64,
    ) -> Result<()> {
        let old_loan = &mut ctx.accounts.old_loan;
        let now = Clock::get()?.unix_timestamp;

        require!(old_loan.status == LoanStatus::Active, FineticError::LoanNotActive);
        require!(
            now >= old_loan.matures_at - (7 * 24 * 60 * 60),
            FineticError::TooEarlyToRenew
        );

        let old_interest_rate = match old_loan.interest_tier {
            0 => 1000u64,
            1 => 2000u64,
            _ => return Err(FineticError::InvalidTier.into()),
        };

        let elapsed = (now - old_loan.started_at) as u64;
        let year_seconds = 365u64 * 24 * 60 * 60;
        let accumulated_interest = old_loan.loan_amount
            .checked_mul(old_interest_rate)
            .unwrap()
            .checked_mul(elapsed)
            .unwrap()
            .checked_div(10000u64.checked_mul(year_seconds).unwrap())
            .unwrap();

        let new_tier = match old_loan.interest_tier {
            0 => 1u8,
            1 => 1u8,
            _ => return Err(FineticError::InvalidTier.into()),
        };

        let new_origination_bps: u64 = 200; // always high tier on renewal

        let new_debt = old_loan.loan_amount.checked_add(accumulated_interest).unwrap();
        let new_origination_fee = new_debt
            .checked_mul(new_origination_bps)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        // Transfer new origination fee from borrower to Finetic
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.borrower_stable_account.to_account_info(),
                    to: ctx.accounts.fee_account.to_account_info(),
                    authority: ctx.accounts.borrower.to_account_info(),
                },
            ),
            new_origination_fee,
        )?;

        old_loan.status = LoanStatus::Renewed;

        let new_loan = &mut ctx.accounts.new_loan;
        let term_seconds = (old_loan.term_months as i64) * 30 * 24 * 60 * 60;

        new_loan.loan_id = new_loan_id;
        new_loan.offer_id = old_loan.offer_id;
        new_loan.lender = old_loan.lender;
        new_loan.borrower = old_loan.borrower;
        new_loan.stable_mint = old_loan.stable_mint;
        new_loan.collateral_mint = old_loan.collateral_mint;
        new_loan.loan_amount = new_debt;
        new_loan.collateral_amount = old_loan.collateral_amount;
        new_loan.interest_tier = new_tier;
        new_loan.interest_fee_bps = 200;
        new_loan.origination_fee = new_origination_fee;
        new_loan.insurance_reserve = new_debt.checked_mul(50).unwrap().checked_div(10000).unwrap();
        new_loan.term_months = old_loan.term_months;
        new_loan.started_at = now;
        new_loan.matures_at = now + term_seconds;
        new_loan.status = LoanStatus::Active;
        new_loan.bump = ctx.bumps.new_loan;

        emit!(LoanRenewed {
            old_loan_id: old_loan.loan_id,
            new_loan_id,
            new_debt,
            new_tier,
            new_origination_fee,
            matures_at: new_loan.matures_at,
        });

        Ok(())
    }

    /// Admin: pause/unpause protocol
    pub fn set_paused(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol_state;
        require!(protocol.admin == ctx.accounts.admin.key(), FineticError::Unauthorized);
        protocol.is_paused = paused;
        Ok(())
    }
}

// ============================================
// ACCOUNTS
// ============================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolState::INIT_SPACE,
        seeds = [b"protocol"],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: Fee wallet address
    pub fee_wallet: UncheckedAccount<'info>,
    /// CHECK: Insurance wallet address
    pub insurance_wallet: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct CreateOffer<'info> {
    #[account(
        init,
        payer = lender,
        space = 8 + Offer::INIT_SPACE,
        seeds = [b"offer", offer_id.to_le_bytes().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,
    #[account(mut)]
    pub lender: Signer<'info>,
    pub stable_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelOffer<'info> {
    #[account(mut)]
    pub offer: Account<'info, Offer>,
    pub lender: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(loan_id: u64)]
pub struct ExecuteLoan<'info> {
    #[account(mut)]
    pub offer: Box<Account<'info, Offer>>,
    #[account(
        init,
        payer = borrower,
        space = 8 + Loan::INIT_SPACE,
        seeds = [b"loan", loan_id.to_le_bytes().as_ref()],
        bump
    )]
    pub loan: Box<Account<'info, Loan>>,
    #[account(mut, seeds = [b"protocol"], bump = protocol_state.bump)]
    pub protocol_state: Box<Account<'info, ProtocolState>>,

    // Parties
    #[account(mut)]
    pub lender: Signer<'info>,
    #[account(mut)]
    pub borrower: Signer<'info>,

    // Mints
    pub collateral_mint: Account<'info, Mint>,

    // Token accounts
    #[account(mut)]
    pub borrower_collateral_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub escrow_collateral_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub lender_stable_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub borrower_stable_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub fee_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RepayLoan<'info> {
    #[account(mut)]
    pub loan: Account<'info, Loan>,
    #[account(mut)]
    pub borrower: Signer<'info>,

    #[account(mut)]
    pub borrower_stable_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub lender_stable_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub fee_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub escrow_collateral_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub borrower_collateral_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimDefault<'info> {
    #[account(mut)]
    pub loan: Account<'info, Loan>,
    #[account(mut)]
    pub lender: Signer<'info>,

    #[account(mut)]
    pub escrow_collateral_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub lender_collateral_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(new_loan_id: u64)]
pub struct RenewLoan<'info> {
    #[account(mut)]
    pub old_loan: Account<'info, Loan>,
    #[account(
        init,
        payer = borrower,
        space = 8 + Loan::INIT_SPACE,
        seeds = [b"loan", new_loan_id.to_le_bytes().as_ref()],
        bump
    )]
    pub new_loan: Account<'info, Loan>,

    #[account(mut)]
    pub borrower: Signer<'info>,
    pub lender: Signer<'info>,

    #[account(mut)]
    pub borrower_stable_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub fee_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut, seeds = [b"protocol"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    pub admin: Signer<'info>,
}

// ============================================
// STATE
// ============================================

#[account]
#[derive(InitSpace)]
pub struct ProtocolState {
    pub admin: Pubkey,
    pub fee_wallet: Pubkey,
    pub insurance_wallet: Pubkey,
    pub total_loans: u64,
    pub total_volume: u64,
    pub total_fees_collected: u64,
    pub bump: u8,
    pub is_paused: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub offer_id: u64,
    pub lender: Pubkey,
    pub stable_mint: Pubkey,
    pub amount: u64,
    pub min_amount: u64,
    pub interest_tier: u8,
    pub term_months: u8,
    pub is_active: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Loan {
    pub loan_id: u64,
    pub offer_id: u64,
    pub lender: Pubkey,
    pub borrower: Pubkey,
    pub stable_mint: Pubkey,
    pub collateral_mint: Pubkey,
    pub loan_amount: u64,
    pub collateral_amount: u64,
    pub interest_tier: u8,
    pub interest_fee_bps: u64,
    pub origination_fee: u64,
    pub insurance_reserve: u64,
    pub term_months: u8,
    pub started_at: i64,
    pub matures_at: i64,
    pub repaid_at: i64,
    pub status: LoanStatus,
    pub referral_platform: Pubkey,
    pub bump: u8,
}

// ============================================
// ENUMS
// ============================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum LoanStatus {
    Active,
    RepaidEarly50,
    RepaidEarly,
    RepaidOnTime,
    Renewed,
    Defaulted,
}

// ============================================
// EVENTS
// ============================================

#[event]
pub struct OfferCreated {
    pub offer_id: u64,
    pub lender: Pubkey,
    pub amount: u64,
    pub interest_tier: u8,
    pub term_months: u8,
}

#[event]
pub struct OfferCancelled {
    pub offer_id: u64,
    pub lender: Pubkey,
}

#[event]
pub struct LoanExecuted {
    pub loan_id: u64,
    pub offer_id: u64,
    pub lender: Pubkey,
    pub borrower: Pubkey,
    pub loan_amount: u64,
    pub collateral_amount: u64,
    pub interest_tier: u8,
    pub matures_at: i64,
}

#[event]
pub struct LoanRepaid {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub lender: Pubkey,
    pub total_repaid: u64,
    pub interest_paid: u64,
    pub platform_fee: u64,
    pub status: LoanStatus,
}

#[event]
pub struct LoanDefaulted {
    pub loan_id: u64,
    pub lender: Pubkey,
    pub borrower: Pubkey,
    pub collateral_amount: u64,
    pub insurance_reserve: u64,
}

#[event]
pub struct LoanRenewed {
    pub old_loan_id: u64,
    pub new_loan_id: u64,
    pub new_debt: u64,
    pub new_tier: u8,
    pub new_origination_fee: u64,
    pub matures_at: i64,
}

// ============================================
// ERRORS
// ============================================

#[error_code]
pub enum FineticError {
    #[msg("Invalid interest tier")]
    InvalidTier,
    #[msg("Invalid loan term — must be 12 or 24 months")]
    InvalidTerm,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Offer is not active")]
    OfferNotActive,
    #[msg("Loan is not active")]
    LoanNotActive,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Loan amount exceeds offer")]
    ExceedsOffer,
    #[msg("Loan amount below minimum")]
    BelowMinimum,
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Loan has not expired yet")]
    LoanNotExpired,
    #[msg("Loan has expired — cannot repay")]
    LoanExpired,
    #[msg("Too early to renew — must be within 7 days of maturity")]
    TooEarlyToRenew,
}
