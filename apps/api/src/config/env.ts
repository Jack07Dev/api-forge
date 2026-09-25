import dotenv from "dotenv";

dotenv.config();

const requiredEnv = [
  "MONGODB_URI",
  "JWT_SECRET"
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT) || 5001,

  nodeEnv: process.env.NODE_ENV || "development",

  mongodbUri: process.env.MONGODB_URI as string,

  jwtSecret: process.env.JWT_SECRET as string
};

