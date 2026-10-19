
import "dotenv/config";
import mongoose from "mongoose";

import APIVersion from "../models/APIVersion.js";

import {
    acquirePublishingLock,
    releasePublishingLock,
    recoverStalePublishingLock,
    publishValidatedAPIVersion
} from "../services/api-publishing.service.js";

const input = {
    organizationId: "6acb65878fa6a3db06fd6356",
    projectId: "6acb66c28fa6a3db06fd6358",
    apiId: "6acb67a48fa6a3db06fd6359",
    versionId: "6acb684d8fa6a3db06fd635a"
};

const assert = (
    condition: unknown,
    message: string
): void => {
    if (!condition) {
        throw new Error(`TEST FAILED: ${message}`);
    }

    console.log(`PASS: ${message}`);
};

const getVersion = async () => {
    const version = await APIVersion.findOne({
        _id: input.versionId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        apiId: input.apiId
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

    try {
        console.log("\nPublishing safety tests started\n");

        // Verify that this is an empty QA draft.
        const initial = await getVersion();

        assert(
            initial.status === "draft",
            "QA version starts in draft status"
        );

        const endpointCount = await mongoose.connection.db!
            .collection("apiendpoints")
            .countDocuments({
                apiVersionId: new mongoose.Types.ObjectId(
                    input.versionId
                )
            });

        assert(
            endpointCount === 0,
            "QA version has no endpoints"
        );

        // TEST 1: Acquire lock.
        const firstLock = await acquirePublishingLock(input);

        assert(
            firstLock.version.status === "publishing",
            "First publishing lock acquired"
        );

        assert(
            Boolean(firstLock.publishingToken),
            "Publishing token generated"
        );

        // TEST 2: Duplicate acquisition must fail.
        let duplicateRejected = false;

        try {
            await acquirePublishingLock(input);
        } catch {
            duplicateRejected = true;
        }

        assert(
            duplicateRejected,
            "Duplicate publishing lock rejected"
        );

        // TEST 3: Wrong token must not release lock.
        let wrongTokenRejected = false;

        try {
            await releasePublishingLock({
                ...input,
                publishingToken: "invalid-token"
            });
        } catch {
            wrongTokenRejected = true;
        }

        assert(
            wrongTokenRejected,
            "Incorrect publishing token rejected"
        );

        assert(
            (await getVersion()).status === "publishing",
            "Incorrect token did not change version status"
        );

        // TEST 4: Correct token releases lock.
        await releasePublishingLock({
            ...input,
            publishingToken: firstLock.publishingToken
        });

        assert(
            (await getVersion()).status === "draft",
            "Correct token restored draft status"
        );

        // TEST 5: Fresh locks must not be recovered.
        const secondLock = await acquirePublishingLock(input);

        const freshRecovery = await recoverStalePublishingLock(input);

        assert(
            freshRecovery.recovered === false,
            "Fresh publishing lock is protected from recovery"
        );

        assert(
            (await getVersion()).status === "publishing",
            "Fresh lock remains intact"
        );

        // TEST 6: Simulate an expired lock.
        // QA ONLY: Change the timestamp, not the token.
        await APIVersion.updateOne(
            {
                _id: input.versionId,
                status: "publishing",
                publishingToken: secondLock.publishingToken
            },
            {
                $set: {
                    publishingStartedAt: new Date(
                        Date.now() - 11 * 60 * 1000
                    )
                }
            }
        );

        const staleRecovery = await recoverStalePublishingLock(input);

        assert(
            staleRecovery.recovered === true,
            "Expired publishing lock recovered"
        );

        const afterRecovery = await getVersion();

        assert(
            afterRecovery.status === "draft",
            "Recovered version returned to draft"
        );

        assert(
            !afterRecovery.publishingToken,
            "Recovered publishing token removed"
        );

        // TEST 7: Empty version fails publishing validation.
        const publishResult =
            await publishValidatedAPIVersion(input);

        assert(
            publishResult.success === false,
            "Publishing an empty version fails"
        );

        assert(
            publishResult.stage === "definition_validation",
            "Failure occurs during definition validation"
        );

        const finalVersion = await getVersion();

        assert(
            finalVersion.status === "draft",
            "Failed publishing restored draft status"
        );

        assert(
            !finalVersion.publishingToken,
            "Failed publishing removed its lock"
        );

        console.log("\nALL PUBLISHING LOCK TESTS PASSED\n");

    } finally {
        await mongoose.disconnect();
    }
};

main().catch((error) => {
    console.error("\nPublishing safety test failed:", error);
    process.exitCode = 1;
});
