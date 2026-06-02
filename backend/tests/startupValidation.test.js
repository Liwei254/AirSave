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
  test("Postgres mode without DATABASE_URL fails fast", () => {
    expectStartupError(
      {
        DATA_STORE: "postgres",
        JWT_SECRET: "dev-secret",
      },
      /DATABASE_URL is required/i
    );
  });

  test("Mongo mode without Mongo URI fails fast", () => {
    expectStartupError(
      {
        JWT_SECRET: "dev-secret",
      },
      /MONGO_URI or MONGODB_URI is required/i
    );
  });

  test("production without JWT_SECRET fails fast", () => {
    expectStartupError(
      {
        NODE_ENV: "production",
        MONGO_URI: "mongodb://localhost:27017/airsave",
      },
      /JWT_SECRET is required/i
    );
  });

  test("valid Postgres env passes validation", () => {
    const summary = validateStartupEnvironment({
      NODE_ENV: "production",
      DATA_STORE: "postgres",
      DATABASE_URL: "postgresql://user:password@localhost:5432/airsave",
      JWT_SECRET: "production-secret",
      ENABLE_OUTBOX_WORKER: "false",
      PORT: "5000",
    });

    expect(summary).toMatchObject({
      datastore: "postgres",
      provider: "postgres",
      postgresMode: true,
      databaseUrlConfigured: true,
      jwtSecretConfigured: true,
      outboxWorkerEnabled: false,
      healthEndpoint: "/api/health/postgres",
    });
  });

  test("valid Mongo env passes validation", () => {
    const summary = validateStartupEnvironment({
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://localhost:27017/airsave",
      JWT_SECRET: "dev-secret",
    });

    expect(summary).toMatchObject({
      datastore: "mongo",
      provider: "mongo-default",
      postgresMode: false,
      mongoUriConfigured: true,
      jwtSecretConfigured: true,
      outboxWorkerEnabled: false,
    });
  });
});
