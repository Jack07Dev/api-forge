
import "dotenv/config";
import mongoose from "mongoose";

import APIVersion from "../models/APIVersion.js";

import {
    publishValidatedAPIVersion,
} from "../services/api-publishing.service.js";

const qa = {
    organizationId: "6acb65878fa6a3db06fd6356",
    projectId: "6acb66c28fa6a3db06fd6358",
    apiId: "6acb67a48fa6a3db06fd6359",
};

const v1Id = "6acb684d8fa6a3db06fd635a";
const v2Id = "6acb778bdb4b8697fbc72a51";

function assert(condition: unknown, message: string): void {
    if (!condition) {
        throw new Error(`TEST FAILED: ${message}`);
    }

    console.log(`PASS: ${message}`);
}

async function getVersion(versionId: string) {
    const version = await APIVersion.findOne({
        _id: versionId,
        ...qa,
    });

    if (!version) {
        throw new Error(`Version not found: ${versionId}`);
    }

    return version;
}

async function getActiveVersions() {
    return APIVersion.find({
        ...qa,
        status: "active",
    });
}

async function main() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(mongoUri);

    try {
        console.log("\nVersion replacement test started\n");

        // ------------------------------------------
        // TEST 1: Verify the initial database state
        // ------------------------------------------

        const v1Before = await getVersion(v1Id);
        const v2Before = await getVersion(v2Id);

        assert(
            v1Before.status === "active",
            "v1 is currently active"
        );

        assert(
            v2Before.status === "draft",
            "v2 is currently draft"
        );

        const activeBefore = await getActiveVersions();

        assert(
            activeBefore.length === 1,
            "Exactly one active version exists before publishing"
        );

        assert(
            String(activeBefore[0]._id) === v1Id,
            "v1 is the active version before publishing"
        );

        // ------------------------------------------
        // TEST 2: Publish v2 through validated flow
        // ------------------------------------------

        console.log("\nPublishing v2...\n");

        const result = await publishValidatedAPIVersion({
            ...qa,
            versionId: v2Id,
        });

        console.log("Publishing result:", result);

        assert(
            result.success === true,
            "v2 publishing succeeded"
        );

        assert(
            result.stage === "published",
            "Publishing completed successfully"
        );

        // ------------------------------------------
        // TEST 3: Verify both version statuses
        // ------------------------------------------

        const v1After = await getVersion(v1Id);
        const v2After = await getVersion(v2Id);

        assert(
            v1After.status === "deprecated",
            "v1 automatically changed to deprecated"
        );

        assert(
            v2After.status === "active",
            "v2 automatically changed to active"
        );

        // ------------------------------------------
        // TEST 4: Verify lock cleanup
        // ------------------------------------------

        assert(
            !v2After.publishingToken,
            "v2 publishing token cleared"
        );

        assert(
            !v2After.publishingStartedAt,
            "v2 publishing timestamp cleared"
        );

        // ------------------------------------------
        // TEST 5: Verify active-version uniqueness
        // ------------------------------------------

        const activeAfter = await getActiveVersions();

        assert(
            activeAfter.length === 1,
            "Exactly one active version exists after publishing"
        );

        assert(
            String(activeAfter[0]._id) === v2Id,
            "v2 is the only active version"
        );

        const publishingCount = await APIVersion.countDocuments({
            ...qa,
            status: "publishing",
        });

        assert(
            publishingCount === 0,
            "No publishing locks remain"
        );

        console.log("\nALL VERSION REPLACEMENT TESTS PASSED\n");

        console.log("Final version statuses:");
        console.log({
            v1: v1After.status,
            v2: v2After.status,
        });

    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error("\nVersion replacement test failed:", error);
    process.exitCode = 1;
});
