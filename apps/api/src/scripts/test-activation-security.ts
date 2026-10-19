
import "dotenv/config";
import mongoose from "mongoose";

import APIVersion from "../models/APIVersion.js";

import {
    acquirePublishingLock,
    releasePublishingLock,
    recoverStalePublishingLock,
} from "../services/api-publishing.service.js";

import {
    activateAPIVersion,
} from "../services/api-version.service.js";

const input = {
    organizationId: "6acb65878fa6a3db06fd6356",
    projectId: "6acb66c28fa6a3db06fd6358",
    apiId: "6acb67a48fa6a3db06fd6359",
    versionId: "6acb684d8fa6a3db06fd635a",
};

const assert = (condition: unknown, message: string) => {
    if (!condition) {
        throw new Error(`TEST FAILED: ${message}`);
    }

    console.log(`PASS: ${message}`);
};

const expectRejection = async (
    operation: () => Promise<unknown>,
    message: string
) => {
    let rejected = false;

    try {
        await operation();
    } catch {
        rejected = true;
    }

    assert(rejected, message);
};

const getVersion = async () => {
    const version = await APIVersion.findOne({
        _id: input.versionId,
        apiId: input.apiId,
        projectId: input.projectId,
        organizationId: input.organizationId,
    });

    if (!version) {
        throw new Error("QA version not found");
    }

    return version;
};

const main = async () => {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(mongoUri);

    let currentToken: string | undefined;

    try {
        console.log("\nActivation security tests started\n");

        const initial = await getVersion();

        assert(
            initial.status === "draft",
            "QA version starts in draft"
        );

        // Test 1: Acquire a legitimate publishing lock.
        const lock = await acquirePublishingLock(input);

        currentToken = lock.publishingToken;

        assert(
            (await getVersion()).status === "publishing",
            "Publishing lock acquired"
        );

        // Test 2: Invalid token must be rejected.
        await expectRejection(
            () =>
                activateAPIVersion({
                    ...input,
                    publishingToken: "invalid-token",
                    definitionRevision: lock.definitionRevision,
                }),
            "Invalid publishing token rejected"
        );

        // Test 3: Incorrect revision must be rejected.
        await expectRejection(
            () =>
                activateAPIVersion({
                    ...input,
                    publishingToken: lock.publishingToken,
                    definitionRevision: lock.definitionRevision + 1,
                }),
            "Incorrect definition revision rejected"
        );

        // Test 4: Rejected activation must not change status.
        const afterRejectedAttempts = await getVersion();

        assert(
            afterRejectedAttempts.status === "publishing",
            "Rejected activation did not change status"
        );

        assert(
            afterRejectedAttempts.publishingToken ===
            lock.publishingToken,
            "Rejected activation preserved original token"
        );

        // Test 5: Release the lock.
        await releasePublishingLock({
            ...input,
            publishingToken: lock.publishingToken,
        });

        currentToken = undefined;

        assert(
            (await getVersion()).status === "draft",
            "Released lock restored draft status"
        );

        // Test 6: A released token cannot activate.
        await expectRejection(
            () =>
                activateAPIVersion({
                    ...input,
                    publishingToken: lock.publishingToken,
                    definitionRevision: lock.definitionRevision,
                }),
            "Released publishing token cannot be reused"
        );

        // Test 7: Acquire another lock and simulate staleness.
        const staleLock = await acquirePublishingLock(input);

        currentToken = staleLock.publishingToken;

        const timestampUpdate = await APIVersion.updateOne(
            {
                _id: input.versionId,
                apiId: input.apiId,
                projectId: input.projectId,
                organizationId: input.organizationId,
                status: "publishing",
                publishingToken: staleLock.publishingToken,
            },
            {
                $set: {
                    publishingStartedAt: new Date(
                        Date.now() - 11 * 60 * 1000
                    ),
                },
            }
        );

        assert(
            timestampUpdate.matchedCount === 1,
            "QA lock timestamp updated for recovery test"
        );

        const recovery = await recoverStalePublishingLock(input);

        assert(
            recovery.recovered === true,
            "Stale publishing lock recovered"
        );

        currentToken = undefined;

        // Test 8: Recovered token cannot activate.
        await expectRejection(
            () =>
                activateAPIVersion({
                    ...input,
                    publishingToken: staleLock.publishingToken,
                    definitionRevision: staleLock.definitionRevision,
                }),
            "Recovered publishing token cannot be reused"
        );

        // Final checks.
        const finalVersion = await getVersion();

        assert(
            finalVersion.status === "draft",
            "QA version remains in draft"
        );

        assert(
            !finalVersion.publishingToken,
            "No publishing token remains"
        );

        assert(
            !finalVersion.publishingStartedAt,
            "No publishing timestamp remains"
        );

        console.log(
            "\nALL ACTIVATION SECURITY TESTS PASSED\n"
        );
    } finally {
        // Best-effort cleanup if a test fails while a lock is held.
        if (currentToken) {
            try {
                await releasePublishingLock({
                    ...input,
                    publishingToken: currentToken,
                });
            } catch (error) {
                console.error(
                    "Automatic cleanup failed; inspect the QA lock:",
                    error
                );
            }
        }

        await mongoose.disconnect();
    }
};

main().catch((error) => {
    console.error("\nActivation security test failed:", error);
    process.exitCode = 1;
});
