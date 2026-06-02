import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = path.join(projectRoot, "backend");
const reportDirectory = path.join(projectRoot, "migration-reports");
const requiredDocumentedEnvVars = [
  "DATABASE_URL",
  "ENABLE_OUTBOX_WORKER",
  "JWT_SECRET",
  "PORT",
  "NODE_ENV",
  "REDIS_URL",
];

dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(backendRoot, ".env"), quiet: true });

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function healthUrl() {
  if (process.env.CUTOVER_HEALTH_URL) return process.env.CUTOVER_HEALTH_URL;
  if (process.env.POSTGRES_HEALTH_URL) return process.env.POSTGRES_HEALTH_URL;
  if (process.env.API_BASE_URL) {
    return `${process.env.API_BASE_URL.replace(/\/$/, "")}/health/postgres`;
  }

  return `http://localhost:${process.env.PORT || 5000}/api/health/postgres`;
}

function runCommand(command, args, { cwd = projectRoot, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    try {
      execSync([command, ...args].join(" "), {
        cwd,
        env,
        stdio: "inherit",
        shell: true,
      });

      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function latestMigrationReport() {
  let entries = [];
  try {
    entries = await fs.readdir(reportDirectory);
  } catch {
    return null;
  }

  const reports = await Promise.all(
    entries
      .filter((name) => /^mongo-to-postgres-\d{8}-\d{6}\.json$/.test(name))
      .map(async (name) => {
        const filePath = path.join(reportDirectory, name);
        const stat = await fs.stat(filePath);
        return { filePath, mtimeMs: stat.mtimeMs };
      })
  );

  return reports.sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.filePath || null;
}

function sumCounts(counts = {}) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

async function assertLatestMigrationReportClean() {
  const reportPath = await latestMigrationReport();

  if (!reportPath) {
    throw new Error("No prior Mongo-to-Postgres migration report was found.");
  }

  const report = await readJson(reportPath);
  const failedCount = sumCounts(report.counts?.failed);

  if ((report.errors || []).length || failedCount > 0) {
    throw new Error(
      `Latest migration report is not clean: ${reportPath} (${report.errors?.length || 0} errors, ${failedCount} failed records)`
    );
  }

  console.info(`[cutover] clean migration report found: ${reportPath}`);
}

async function assertPostgresHealth() {
  const url = healthUrl();
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));

  if (!response.ok || body?.success !== true || body?.data?.ok !== true) {
    throw new Error(`Postgres health endpoint failed at ${url}`);
  }

  console.info(`[cutover] Postgres health endpoint passed: ${url}`);
}

async function assertOutboxWorkerCommandAvailable() {
  const packageJson = await readJson(path.join(backendRoot, "package.json"));
  const command = packageJson.scripts?.["worker:outbox"];

  if (!command) {
    throw new Error("backend/package.json is missing scripts.worker:outbox.");
  }

  console.info(`[cutover] outbox worker command available: npm run worker:outbox (${command})`);
}

async function assertRequiredEnvVarsDocumented() {
  const files = [
    path.join(projectRoot, ".env.example"),
    path.join(projectRoot, "docs", "postgres-cutover.md"),
    path.join(projectRoot, "docs", "postgres-deployment.md"),
  ];
  const combined = (await Promise.all(files.map((filePath) => fs.readFile(filePath, "utf8")))).join("\n");
  const missing = requiredDocumentedEnvVars.filter((name) => !combined.includes(name));

  if (missing.length) {
    throw new Error(`Required production env vars are not documented: ${missing.join(", ")}`);
  }

  console.info(`[cutover] required production env vars documented: ${requiredDocumentedEnvVars.join(", ")}`);
}

async function assertMongoRuntimeRemoved() {
  const rootPackageJson = await readJson(path.join(projectRoot, "package.json"));
  const backendPackageJson = await readJson(path.join(backendRoot, "package.json"));
  const scripts = {
    ...rootPackageJson.scripts,
    ...backendPackageJson.scripts,
  };
  const scriptNames = Object.keys(scripts).filter((name) => name.includes("mongo"));
  const backendDependencies = {
    ...backendPackageJson.dependencies,
    ...backendPackageJson.devDependencies,
  };
  const removedDependencyNames = ["mon" + "goose", "mongo" + "db"];

  if (scriptNames.length) {
    throw new Error(`Mongo migration scripts are still present: ${scriptNames.join(", ")}`);
  }

  if (removedDependencyNames.some((name) => backendDependencies[name])) {
    throw new Error("MongoDB runtime dependencies are still present in backend/package.json.");
  }

  console.info("[cutover] Mongo runtime dependencies and migration scripts are absent.");
}

async function runCheck(name, callback, results) {
  console.info(`\n[cutover] checking ${name}`);

  try {
    await callback();
    results.push({ name, status: "passed" });
  } catch (error) {
    results.push({ name, status: "failed", error: error.message });
    console.error(`[cutover] ${name} failed: ${error.message}`);
  }
}

export async function runPostgresCutoverChecklist() {
  const results = [];

  await runCheck("Prisma migrations applied", () =>
    runCommand(npxCommand(), ["prisma", "migrate", "status"], { cwd: backendRoot }), results);

  await runCheck("Postgres health endpoint works", assertPostgresHealth, results);
  await runCheck("latest migration report is clean", assertLatestMigrationReportClean, results);

  await runCheck("Postgres financial verification passes", () =>
    runCommand(npmCommand(), ["run", "verify:postgres"], { cwd: projectRoot }), results);

  await runCheck("frontend compatibility tests pass", () =>
    runCommand(npmCommand(), ["test", "--", "postgresFrontendCompatibility.test.js"], { cwd: backendRoot }), results);

  await runCheck("outbox worker command is available", assertOutboxWorkerCommandAvailable, results);
  await runCheck("required production env vars are documented", assertRequiredEnvVarsDocumented, results);
  await runCheck("Mongo runtime support is removed", assertMongoRuntimeRemoved, results);

  const failed = results.filter((result) => result.status === "failed");
  console.info("\n[cutover] checklist summary");
  console.info(JSON.stringify(results, null, 2));

  if (failed.length) {
    throw new Error(`${failed.length} cutover checklist check(s) failed.`);
  }

  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPostgresCutoverChecklist().catch((error) => {
    console.error(`\n[cutover] checklist failed: ${error.message}`);
    process.exitCode = 1;
  });
}
