
import "dotenv/config";
import mongoose from "mongoose";

import {
    acquirePublishingLock,
    releasePublishingLock,
    recoverStalePublishingLock,
} from "../services/api-publishing.service.js";

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
    const _id = new mongoose.Types.ObjectId(input.versionId);

    let ownedToken: string | undefined;

    try {
        // Precondition: QA v4 must be a clean draft.
        const before = await collection.findOne({ _id });

        if (
            before?.status !== "draft" ||
            before.publishingToken ||
            before.publishingStartedAt
        ) {
            throw new Error("QA v4 must be a clean draft");
        }

        console.log("PASS 1: QA v4 is a clean draft");

        // Acquire a real publishing lock.
        const lock = await acquirePublishingLock(input);
        ownedToken = lock.publishingToken;

        // TEST 1: Fresh lock must not be recovered.
        const freshResult = await recoverStalePublishingLock(input);

        if (freshResult.recovered) {
            throw new Error("Fresh lock was incorrectly recovered");
        }

        const freshVersion = await collection.findOne({ _id });

        if (
            freshVersion?.status !== "publishing" ||
            freshVersion.publishingToken !== ownedToken
        ) {
            throw new Error("Fresh publishing lock was modified");
        }

        console.log("PASS 2: Fresh lock was not recovered");

        // TEST 2: Simulate an expired lock.
        const expiredTime = new Date(Date.now() - 11 * 60 * 1000);

        const timestampUpdate = await collection.updateOne(
            {
                _id,
                status: "publishing",
                publishingToken: ownedToken,
            },
            {
                $set: {
                    publishingStartedAt: expiredTime,
                },
            }
        );

        if (timestampUpdate.matchedCount !== 1) {
            throw new Error("Could not set QA lock expiration");
        }

        const staleResult = await recoverStalePublishingLock(input);

        if (!staleResult.recovered) {
            throw new Error("Expired lock was not recovered");
        }

        const recoveredVersion = await collection.findOne({ _id });

        if (
            recoveredVersion?.status !== "draft" ||
            recoveredVersion.publishingToken ||
            recoveredVersion.publishingStartedAt
        ) {
            throw new Error("Expired lock cleanup was incomplete");
        }

        ownedToken = undefined;

        console.log("PASS 3: Expired lock recovered");
        console.log("PASS 4: Expired lock fields removed");

        // TEST 3: A stale token cannot release a new lock.
        const newLock = await acquirePublishingLock(input);
        ownedToken = newLock.publishingToken;

        const oldToken = lock.publishingToken;

        if (oldToken === ownedToken) {
            throw new Error("Lock tokens should be unique");
        }

        let oldTokenRejected = false;

        try {
            await releasePublishingLock({
                ...input,
                publishingToken: oldToken,
            });
        } catch (error) {
            if (
                error instanceof Error &&
                error.message ===
                "Publishing lock not found or token does not match"
            ) {
                oldTokenRejected = true;
            } else {
                throw error;
            }
        }

        if (!oldTokenRejected) {
            throw new Error("Old token unexpectedly released new lock");
        }

        const protectedVersion = await collection.findOne({ _id });

        if (
            protectedVersion?.status !== "publishing" ||
            protectedVersion.publishingToken !== ownedToken
        ) {
            throw new Error("New publishing lock was modified");
        }

        console.log("PASS 5: Old token cannot release new lock");

        // Release the current lock.
        await releasePublishingLock({
            ...input,
            publishingToken: ownedToken,
        });

        ownedToken = undefined;

        const finalVersion = await collection.findOne({ _id });

        if (
            finalVersion?.status !== "draft" ||
            finalVersion.publishingToken ||
            finalVersion.publishingStartedAt
        ) {
            throw new Error("QA v4 was not restored to draft");
        }

        console.log("PASS 6: QA v4 restored to draft");

        // Verify active v3 is unchanged.
        const v3 = await collection.findOne({
            _id: new mongoose.Types.ObjectId(
                "6acb8661d220ffe6e126a427"
            ),
        });

        if (v3?.status !== "active") {
            throw new Error("QA v3 is no longer active");
        }

        console.log("PASS 7: Active v3 unchanged");
        console.log("SUCCESS: All 7 stale-lock tests passed");
    } finally {
        // Best-effort cleanup only for the token this test owns.
        if (ownedToken) {
            try {
                await releasePublishingLock({
                    ...input,
                    publishingToken: ownedToken,
                });
            } catch (error) {
                console.error("Cleanup warning:", error);
            }
        }

        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error("TEST FAILED:", error);
    process.exitCode = 1;
});
