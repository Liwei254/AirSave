import request from "supertest";
import app from "../app.js";

let userCounter = 0;

export function makeUser(overrides = {}) {
  userCounter += 1;
  const suffix = String(700000000 + userCounter).slice(-9);

  return {
    fullName: `Test User ${userCounter}`,
    email: `test-${userCounter}@airsave.test`,
    phone: `+254${suffix}`,
    password: `Passw0rd!${userCounter}`,
    ...overrides,
  };
}

export async function registerAgent(overrides = {}) {
  const user = makeUser(overrides);
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/register").send(user).expect(201);

  return {
    agent,
    user,
    auth: response.body.data,
  };
}

export async function loginAgent(user) {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/auth/login")
    .send({ emailOrPhone: user.phone, password: user.password })
    .expect(200);

  return {
    agent,
    auth: response.body.data,
  };
}

export function expectSuccess(response) {
  expect(response.body).toMatchObject({ success: true });
  expect(response.body.data).toBeDefined();
  return response.body.data;
}

export function expectError(response, statusCode, messagePattern) {
  expect(response.status).toBe(statusCode);
  expect(response.body).toMatchObject({ success: false });
  if (messagePattern) {
    expect(response.body.message).toMatch(messagePattern);
  }
}

export function wait(ms = 10) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
