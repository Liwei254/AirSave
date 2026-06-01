export const DEFAULT_LEDGER_ACCOUNT_TYPES = [
  "available_funds",
  "savings",
  "pending_outbound",
  "fees",
  "clearing",
];

export async function createWalletWithDefaultAccounts(tx, userId, currencyCode = "KES") {
  const wallet = await tx.wallet.create({
    data: {
      userId,
    },
  });

  await ensureDefaultLedgerAccounts(tx, wallet.id, currencyCode);

  return wallet;
}

export async function ensureDefaultLedgerAccounts(tx, walletId, currencyCode = "KES") {
  await tx.ledgerAccount.createMany({
    data: DEFAULT_LEDGER_ACCOUNT_TYPES.map((accountType) => ({
      walletId,
      accountType,
      currencyCode,
    })),
    skipDuplicates: true,
  });

  return tx.ledgerAccount.findMany({
    where: {
      walletId,
      currencyCode,
      accountType: {
        in: DEFAULT_LEDGER_ACCOUNT_TYPES,
      },
    },
  });
}

export async function getWalletByUserId(tx, userId) {
  return tx.wallet.findUnique({
    where: {
      userId,
    },
    include: {
      accounts: true,
    },
  });
}

export async function getWalletOrCreate(tx, userId, currencyCode = "KES") {
  const existingWallet = await getWalletByUserId(tx, userId);

  if (existingWallet) {
    await ensureDefaultLedgerAccounts(tx, existingWallet.id, currencyCode);
    return getWalletByUserId(tx, userId);
  }

  await createWalletWithDefaultAccounts(tx, userId, currencyCode);
  return getWalletByUserId(tx, userId);
}

export function getAccountByType(wallet, accountType, currencyCode = "KES") {
  return wallet.accounts.find(
    (account) => account.accountType === accountType && account.currencyCode === currencyCode
  );
}
