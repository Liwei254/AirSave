export function expectUserShape(expect, user) {
  expect(user).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      _id: expect.any(String),
      fullName: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      role: expect.any(String),
      wallet: expect.any(String),
      status: expect.any(String),
      roundUpRule: expect.any(Number),
      preferences: expect.any(Object),
    })
  );
}

export function expectWalletShape(expect, wallet) {
  expect(wallet).toEqual(
    expect.objectContaining({
      walletId: expect.any(String),
      balance: expect.any(Number),
      transactionsCount: expect.any(Number),
    })
  );
}

export function expectGoalShape(expect, goal) {
  expect(goal).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      _id: expect.any(String),
      name: expect.any(String),
      targetAmount: expect.any(Number),
      savedAmount: expect.any(Number),
      currentAmount: expect.any(Number),
      status: expect.any(String),
      expectedCompletionDate: expect.anything(),
    })
  );
}

export function expectTransactionShape(expect, transaction) {
  expect(transaction).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      _id: expect.any(String),
      amount: expect.any(Number),
      savings: expect.any(Number),
      status: expect.any(String),
      reference: expect.any(String),
      type: expect.any(String),
      transactionType: expect.any(String),
      date: expect.anything(),
      createdAt: expect.anything(),
    })
  );
}

export function expectWalletTransactionShape(expect, transaction) {
  expect(transaction).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      _id: expect.any(String),
      amount: expect.any(Number),
      type: expect.any(String),
      reference: expect.any(String),
      status: expect.any(String),
      createdAt: expect.anything(),
    })
  );
}

export function expectNotificationShape(expect, notification) {
  expect(notification).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      _id: expect.any(String),
      user: expect.any(String),
      message: expect.any(String),
      type: expect.any(String),
      read: expect.any(Boolean),
      createdAt: expect.anything(),
    })
  );
}
