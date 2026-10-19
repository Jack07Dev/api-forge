import "dotenv/config";
import mongoose from "mongoose";

import {
    publishValidatedAPIVersion,
} from "../services/api-publishing.service.js";

const version = {
    organizationId: "6acb65878fa6a3db06fd6356",
    projectId: "6acb66c28fa6a3db06fd6358",
    apiId: "6acb67a48fa6a3db06fd6359",
    versionId: "6acb980ad92ae588abdc7fa7",
};

async function main() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is missing");
    }

    process.env.NODE_ENV = "test";
    process.env.PUBLISHING_TEST_FAILURE = "true";

    await mongoose.connect(mongoUri);

    try {
        const collection = mongoose.connection.collection("apiversions");
        const versionObjectId = new mongoose.Types.ObjectId(version.versionId);

        const before = await collection.findOne({
            _id: versionObjectId,
        });

        if (
            before?.status !== "draft" ||
            before.publishingToken ||
            before.publishingStartedAt
        ) {
            throw new Error("QA v4 is not in a clean draft state");
        }

        let expectedErrorCaught = false;

        try {
            await publishValidatedAPIVersion(version);
        } catch (error) {
            if (
                error instanceof Error &&
                error.message === "SIMULATED_PUBLISHING_FAILURE"
            ) {
                expectedErrorCaught = true;
                console.log("PASS: Unexpected publishing exception propagated");
            } else {
                throw error;
            }
        }

        if (!expectedErrorCaught) {
            throw new Error("Expected publishing exception was not thrown");
        }

        const after = await collection.findOne({
            _id: versionObjectId,
        });

        if (
            after?.status !== "draft" ||
            after.publishingToken ||
            after.publishingStartedAt
        ) {
            throw new Error("Publishing lock was not cleaned up");
        }

        console.log("PASS: v4 returned to draft");
        console.log("PASS: Publishing lock fields removed");

        const activeVersion = await collection.findOne({
            _id: new mongoose.Types.ObjectId(
                "6acb8661d220ffe6e126a427"
            ),
        });

        if (activeVersion?.status !== "active") {
            throw new Error("Active v3 was unexpectedly modified");
        }

        console.log("PASS: Active v3 remains unchanged");
        console.log("SUCCESS: Unexpected publishing failure test passed");
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error("TEST FAILED:", error);
    process.exitCode = 1;
});