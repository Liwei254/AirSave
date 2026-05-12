import request from "supertest";
import app from "../app.js";
import { expectError, expectSuccess, loginAgent, makeUser, registerAgent } from "./helpers.js";

describe("Auth core flows", () => {
  test("registers a user and authenticates protected routes with cookies", async () => {
    const user = makeUser();
    const agent = request.agent(app);

    const registerResponse = await agent.post("/api/auth/register").send(user).expect(201);
    const data = expectSuccess(registerResponse);

    expect(data.user).toMatchObject({
      email: user.email,
      phone: user.phone,
    });
    expect(data.token).toEqual(expect.any(String));
    expect(registerResponse.headers["set-cookie"]?.join(";")).toContain("airsave_access");

    const profileResponse = await agent.get("/api/auth/me").expect(200);
    expect(expectSuccess(profileResponse).user.phone).toBe(user.phone);
  });

  test("logs in an existing user and keeps the session cookie usable", async () => {
    const { user } = await registerAgent();
    const { agent, auth } = await loginAgent(user);

    expect(auth.token).toEqual(expect.any(String));

    const profileResponse = await agent.get("/api/auth/me").expect(200);
    expect(expectSuccess(profileResponse).user.email).toBe(user.email);
  });

  test("rejects duplicate phone and email registration", async () => {
    const { user } = await registerAgent();

    const duplicatePhone = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Duplicate Phone",
        email: "duplicate-phone@airsave.test",
        phone: user.phone,
        password: user.password,
      });
    expectError(duplicatePhone, 409, /already exists/i);

    const duplicateEmail = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Duplicate Email",
        email: user.email,
        phone: "+254711111111",
        password: user.password,
      });
    expectError(duplicateEmail, 409, /already exists/i);
  });

  test("rejects invalid login credentials", async () => {
    const { user } = await registerAgent();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ emailOrPhone: user.phone, password: "wrong-password" });

    expectError(response, 401, /invalid email\/phone or password/i);
  });
});
