
type AppEnvironment = "development" | "test" | "production";

const nodeEnv = process.env.NODE_ENV;

const allowedEnvironments = [
  "development",
  "test",
  "production",
];

if (!nodeEnv || !allowedEnvironments.includes(nodeEnv)) {
  throw new Error(
    "NODE_ENV must be development, test, or production"
  );
}

const requiredEnv = ["MONGODB_URI", "JWT_SECRET"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

const mongodbUri = process.env.MONGODB_URI as string;

let databaseName: string;

try {
  const uri = new URL(mongodbUri);

  if (!["mongodb:", "mongodb+srv:"].includes(uri.protocol)) {
    throw new Error("Unsupported MongoDB URI protocol");
  }

  databaseName = decodeURIComponent(uri.pathname.slice(1));
} catch {
  throw new Error("Invalid MONGODB_URI");
}

const expectedDatabase: Record<AppEnvironment, string> = {
  development: "api_forge_dev",
  test: "api_forge_test",
  production: "api_forge_prod",
};

const environment = nodeEnv as AppEnvironment;

if (databaseName !== expectedDatabase[environment]) {
  throw new Error(
    `Database safety check failed: ${environment} must use ${expectedDatabase[environment]}`
  );
}

const port = Number(process.env.PORT ?? 5001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Invalid PORT");
}

export const env = {
  port,
  nodeEnv: environment,
  mongodbUri,
  jwtSecret: process.env.JWT_SECRET as string,
  databaseName,
};
