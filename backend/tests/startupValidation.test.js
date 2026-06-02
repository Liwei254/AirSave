import { describe, expect, test } from "@jest/globals";
import {
  StartupValidationError,
  validateStartupEnvironment,
} from "../config/startupValidation.js";

function expectStartupError(env, messagePattern) {
  try {
    validateStartupEnvironment(env);
    throw new Error("Expected startup validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(StartupValidationError);
    expect(error.message).toMatch(messagePattern);
  }
}

describe("startup environment validation", () => {
  test("missing DATABASE_URL fails fast", () => {
    expectStartupError(
      {
        JWT_SECRET: "dev-secret",
      },
      /DATABASE_URL is required/i
    );
  });

  test("production without JWT_SECRET fails fast", () => {
    expectStartupError(
      {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:password@localhost:5432/airsave",
      },
      /JWT_SECRET is required/i
    );
  });

  test("valid PostgreSQL env passes validation", () => {
    const summary = validateStartupEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/airsave",
      JWT_SECRET: "production-secret",
      ENABLE_OUTBOX_WORKER: "false",
      PORT: "5000",
    });

    expect(summary).toMatchObject({
      datastore: "postgres",
      provider: "prisma",
      databaseUrlConfigured: true,
      jwtSecretConfigured: true,
      outboxWorkerEnabled: false,
      healthEndpoint: "/api/health/postgres",
    });
  });
});
