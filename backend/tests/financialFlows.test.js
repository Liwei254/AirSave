import Ledger from "../models/Ledger.js";
import Transaction from "../models/Transaction.js";
import { expectError, expectSuccess, registerAgent, wait } from "./helpers.js";

async function getWalletBalance(agent) {
  const response = await agent.get("/api/wallet").expect(200);
  return expectSuccess(response).balance;
}

async function deposit(agent, amount = 1000, phoneNumber = "+254700000001") {
  const response = await agent
    .post("/api/wallet/deposit")
    .send({ amount, phoneNumber, sourceMethod: "M-Pesa" })
    .expect(201);

  return expectSuccess(response);
}

async function createGoal(agent, payload = {}) {
  const response = await agent
    .post("/api/goals")
    .send({
      name: "Emergency Fund",
      targetAmount: 1000,
      duration: "30 days",
      durationUnit: "days",
      expectedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      ...payload,
    })
    .expect(201);

  return expectSuccess(response);
}

describe("Wallet flows", () => {
  test("deposit increases wallet balance", async () => {
    const { agent, user } = await registerAgent();

    expect(await getWalletBalance(agent)).toBe(0);

    const result = await deposit(agent, 5000, user.phone);
    expect(result.balance).toBe(5000);
    expect(await getWalletBalance(agent)).toBe(5000);
  });

  test("send decreases wallet balance", async () => {
    const { agent, user } = await registerAgent();
    await deposit(agent, 1000, user.phone);

    const sendResponse = await agent
      .post("/api/transactions/send")
      .send({
        amount: 200,
        phone: "+254711000001",
        merchant: "Send to test recipient",
        description: "Test transfer",
      })
      .expect(201);

    expectSuccess(sendResponse);
    expect(await getWalletBalance(agent)).toBe(800);
  });

  test("cannot send more than wallet balance", async () => {
    const { agent, user } = await registerAgent();
    await deposit(agent, 100, user.phone);

    const response = await agent
      .post("/api/transactions/send")
      .send({
        amount: 200,
        phone: "+254711000002",
        merchant: "Too much",
        description: "Insufficient test",
      });

    expectError(response, 400, /insufficient wallet balance/i);
    expect(await getWalletBalance(agent)).toBe(100);
  });
});

describe("Buy Goods and round-up flows", () => {
  test("uses saved round-up rule, debits rounded amount, credits active goal, and records ledgers/transaction", async () => {
    const { agent, user, auth } = await registerAgent();
    await agent.patch("/api/auth/me").send({ roundUpRule: 50, preferences: { autoSaveEnabled: true } }).expect(200);
    await deposit(agent, 1000, user.phone);
    const goal = await createGoal(agent);

    const response = await agent
      .post("/api/transactions/buy-goods")
      .send({
        amount: 123,
        tillNumber: "123456",
        merchant: "Till 123456",
        description: "Lunch purchase",
      })
      .expect(201);

    const data = expectSuccess(response);
    expect(data.roundUpRule).toBe(50);
    expect(data.chargedAmount).toBe(150);
    expect(data.savingsAmount).toBe(27);
    expect(await getWalletBalance(agent)).toBe(877);

    const activeGoalResponse = await agent.get("/api/goals/active").expect(200);
    const activeGoal = expectSuccess(activeGoalResponse).goal;
    expect(activeGoal._id).toBe(goal._id);
    expect(activeGoal.currentAmount).toBe(27);

    const transaction = await Transaction.findOne({ user: auth.user._id, transactionType: "purchase" });
    expect(transaction).toBeTruthy();
    expect(transaction.savingsAmount).toBe(27);

    const ledgers = await Ledger.find({ user: auth.user._id, reference: { $regex: data.paymentReference } });
    expect(ledgers).toHaveLength(2);
    expect(ledgers.map((entry) => `${entry.type}:${entry.amount}`).sort()).toEqual(["CREDIT:27", "DEBIT:150"]);
  });

  test("credits savings wallet when there is no active goal", async () => {
    const { agent, user, auth } = await registerAgent();
    await agent.patch("/api/auth/me").send({ roundUpRule: 50, preferences: { autoSaveEnabled: true } }).expect(200);
    await deposit(agent, 1000, user.phone);

    const response = await agent
      .post("/api/transactions/buy-goods")
      .send({
        amount: 123,
        tillNumber: "654321",
        merchant: "Till 654321",
        description: "No-goal purchase",
      })
      .expect(201);

    const data = expectSuccess(response);
    expect(data.goal).toBeNull();
    expect(data.savingsAmount).toBe(27);
    expect(await getWalletBalance(agent)).toBe(877);

    const transaction = await Transaction.findOne({ user: auth.user._id, transactionType: "purchase" });
    expect(transaction.goal).toBeNull();

    const ledgers = await Ledger.find({ user: auth.user._id, reference: { $regex: data.paymentReference } });
    expect(ledgers.map((entry) => `${entry.type}:${entry.amount}`).sort()).toEqual(["CREDIT:27", "DEBIT:150"]);
  });
});

describe("Goal flows", () => {
  test("creates one active goal, blocks a second, fetches active goal, and updates progress", async () => {
    const { agent } = await registerAgent();

    const goal = await createGoal(agent, { name: "Rent Goal", targetAmount: 2000 });

    const duplicateResponse = await agent
      .post("/api/goals")
      .send({
        name: "Second Goal",
        targetAmount: 500,
        duration: "30 days",
        durationUnit: "days",
        expectedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
      });
    expectError(duplicateResponse, 400, /one active goal/i);

    const activeResponse = await agent.get("/api/goals/active").expect(200);
    expect(expectSuccess(activeResponse).goal._id).toBe(goal._id);

    const updateResponse = await agent
      .put(`/api/goals/${goal._id}`)
      .send({
        name: "Rent Goal",
        targetAmount: 2000,
        currentAmount: 250,
        savedAmount: 250,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
      })
      .expect(200);

    expect(expectSuccess(updateResponse).currentAmount).toBe(250);
  });
});

describe("Withdraw flows", () => {
  test("withdraws from wallet", async () => {
    const { agent, user } = await registerAgent();
    await deposit(agent, 500, user.phone);

    const response = await agent
      .post("/api/transactions/withdraw")
      .send({ amount: 100, fee: 0, totalDeducted: 100, sourceType: "wallet", phoneNumber: user.phone })
      .expect(201);

    expectSuccess(response);
    expect(await getWalletBalance(agent)).toBe(400);
  });

  test("withdraws from active goal when balance allows it", async () => {
    const { agent, user } = await registerAgent();
    await agent.patch("/api/auth/me").send({ roundUpRule: 50, preferences: { autoSaveEnabled: true } }).expect(200);
    await deposit(agent, 500, user.phone);
    const goal = await createGoal(agent);

    await agent
      .post("/api/transactions/buy-goods")
      .send({ amount: 123, tillNumber: "123456", merchant: "Till 123456" })
      .expect(201);

    const response = await agent
      .post("/api/transactions/withdraw")
      .send({
        amount: 10,
        fee: 0,
        totalDeducted: 10,
        sourceType: "goal",
        sourceId: goal._id,
        phoneNumber: user.phone,
      })
      .expect(201);

    expectSuccess(response);

    const activeGoalResponse = await agent.get("/api/goals/active").expect(200);
    expect(expectSuccess(activeGoalResponse).goal.currentAmount).toBe(17);
    expect(await getWalletBalance(agent)).toBe(367);
  });

  test("rejects insufficient withdrawal balance", async () => {
    const { agent, user } = await registerAgent();
    await deposit(agent, 100, user.phone);

    const response = await agent
      .post("/api/transactions/withdraw")
      .send({ amount: 500, fee: 0, totalDeducted: 500, sourceType: "wallet", phoneNumber: user.phone });

    expectError(response, 400, /insufficient savings balance/i);
    expect(await getWalletBalance(agent)).toBe(100);
  });
});

describe("Activity history", () => {
  test("shows deposit, send, buy goods, and withdraw records newest first", async () => {
    const { agent, user } = await registerAgent();

    await deposit(agent, 1000, user.phone);
    await wait();
    await agent
      .post("/api/transactions/send")
      .send({ amount: 100, phone: "+254711000003", merchant: "Send activity" })
      .expect(201);
    await wait();
    await agent
      .post("/api/transactions/buy-goods")
      .send({ amount: 123, tillNumber: "123456", merchant: "Till activity" })
      .expect(201);
    await wait();
    await agent
      .post("/api/transactions/withdraw")
      .send({ amount: 50, fee: 0, totalDeducted: 50, sourceType: "wallet", phoneNumber: user.phone })
      .expect(201);

    const response = await agent.get("/api/transactions/activity").expect(200);
    const activity = expectSuccess(response);
    const types = activity.map((item) => item.type);

    expect(types).toEqual(expect.arrayContaining(["deposit", "send", "buy-goods", "withdraw"]));
    expect(activity[0].type).toBe("withdraw");

    const timestamps = activity.map((item) => new Date(item.date || item.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((left, right) => right - left));
  });
});
