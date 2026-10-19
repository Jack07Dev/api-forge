
import "dotenv/config";
import mongoose from "mongoose";

import APIVersion from "../models/APIVersion.js";
import {
    publishValidatedAPIVersion,
} from "../services/api-publishing.service.js";

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

async function main() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(mongoUri);

    try {
        console.log("\nSuccessful publishing test started\n");

        const before = await APIVersion.findOne({
            _id: input.versionId,
            apiId: input.apiId,
            projectId: input.projectId,
            organizationId: input.organizationId,
        });

        assert(before?.status === "draft", "QA version is draft");

        const result = await publishValidatedAPIVersion(input);

        console.log("Publishing result:", result);

        assert(result.success === true, "Publishing succeeded");

        const after = await APIVersion.findOne({
            _id: input.versionId,
            apiId: input.apiId,
            projectId: input.projectId,
            organizationId: input.organizationId,
        });

        assert(after?.status === "active", "QA version is active");
        assert(!after?.publishingToken, "Publishing token cleared");
        assert(!after?.publishingStartedAt, "Publishing timestamp cleared");

        const activeVersions = await APIVersion.countDocuments({
            apiId: input.apiId,
            projectId: input.projectId,
            organizationId: input.organizationId,
            status: "active",
        });

        assert(activeVersions === 1, "Exactly one active version exists");

        console.log("\nSUCCESSFUL PUBLISHING TEST PASSED\n");
    } finally {
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error("\nPublishing test failed:", error);
    process.exitCode = 1;
});
