import "dotenv/config";
import mongoose from "mongoose";

import { acquirePublishingLock } from "../services/api-publishing.service.js";
import { runPublishingLockRecovery } from "../workers/publishing-lock-recovery.worker.js";

const input = {
    organizationId: "6acb65878fa6a3db06fd6356",
    projectId: "6acb66c28fa6a3db06fd6358",
    apiId: "6acb67a48fa6a3db06fd6359",
    versionId: "6acb980ad92ae588abdc7fa7",
};

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const collection = mongoose.connection.collection("apiversions");
    const versionId = new mongoose.Types.ObjectId(input.versionId);
    let ownedToken: string | undefined;

    try {
        const before = await collection.findOne({ _id: versionId });

        if (
            before?.status !== "draft" ||
            before.publishingToken ||
            before.publishingStartedAt
        ) {
            throw new Error("QA v4 must be a clean draft");
        }

        console.log("PASS 1: QA v4 starts as draft");

        const lock = await acquirePublishingLock(input);
        ownedToken = lock.publishingToken;

        // Simulate a lock older than 10 minutes.
        const expiredTime = new Date(Date.now() - 11 * 60 * 1000);

        const update = await collection.updateOne(
            {
                _id: versionId,
                status: "publishing",
                publishingToken: ownedToken,
            },
            {
                $set: {
                    publishingStartedAt: expiredTime,
                },
            }
        );

        if (update.matchedCount !== 1) {
            throw new Error("Failed to expire QA lock");
        }

        // Run the worker manually.
        await runPublishingLockRecovery();

        const after = await collection.findOne({ _id: versionId });

        if (
            after?.status !== "draft" ||
            after.publishingToken ||
            after.publishingStartedAt
        ) {
            throw new Error("Recovery worker did not clean the lock");
        }

        ownedToken = undefined;

        console.log("PASS 2: Recovery worker restored v4 to draft");
        console.log("PASS 3: Recovery worker removed lock metadata");

        const v3 = await collection.findOne({
            _id: new mongoose.Types.ObjectId(
                "6acb8661d220ffe6e126a427"
            ),
        });

        if (v3?.status !== "active") {
            throw new Error("Active v3 was modified");
        }

        console.log("PASS 4: Active v3 remains unchanged");
        console.log("SUCCESS: Recovery worker integration test passed");
    } finally {
        if (ownedToken) {
            // Cleanup only the lock created by this test.
            await collection.updateOne(
                {
                    _id: versionId,
                    status: "publishing",
                    publishingToken: ownedToken,
                },
                {
                    $set: { status: "draft" },
                    $unset: {
                        publishingToken: "",
                        publishingStartedAt: "",
                    },
                }
            );
        }

        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error("TEST FAILED:", error);
    process.exitCode = 1;
});