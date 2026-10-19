import type { Server } from "node:http";
import mongoose from "mongoose";

import app from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

import {
  startPublishingLockRecoveryWorker,
  stopPublishingLockRecoveryWorker,
} from "./workers/publishing-lock-recovery.worker.js";

let httpServer: Server | undefined;
let shuttingDown = false;

const startServer = async (): Promise<void> => {
  try {
    // Step 1: Connect to MongoDB
    await connectDatabase();
    console.log(
      "Connected MongoDB database:",
      mongoose.connection.db?.databaseName
    );
    // Step 2: Start automatic stale-lock recovery
    startPublishingLockRecoveryWorker();

    // Step 3: Start Express server
    httpServer = app.listen(env.port, () => {
      console.log(
        `API Platform server running on http://localhost:${env.port}`
      );
    });
  } catch (error) {
    console.error("Failed to start API Platform:", error);
    stopPublishingLockRecoveryWorker();
    await mongoose.disconnect();
    process.exitCode = 1;
  }
};

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received. Shutting down...`);

  // Stop scheduling new recovery scans.
  stopPublishingLockRecoveryWorker();

  try {
    // Stop accepting new HTTP connections and wait for
    // existing requests to complete.
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    await mongoose.disconnect();

    console.log("API Platform shut down successfully");
  } catch (error) {
    console.error("Shutdown failed:", error);
    process.exitCode = 1;
  }
};

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void startServer();