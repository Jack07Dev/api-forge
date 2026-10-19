import "dotenv/config";
import mongoose from "mongoose";
import {
    acquirePublishingLock,
    releasePublishingLock,
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

    await mongoose.connect(mongoUri);

    let lock:
        | Awaited<ReturnType<typeof acquirePublishingLock>>
        | undefined;

    try {
        const before = await mongoose.connection
            .collection("apiversions")
            .findOne({ _id: new mongoose.Types.ObjectId(version.versionId) });

        if (before?.status !== "draft") {
            throw new Error("QA v4 must be draft before running this test");
        }

        // Two publishers attempt to acquire the same lock.
        const results = await Promise.allSettled([
            acquirePublishingLock(version),
            acquirePublishingLock(version),
        ]);

        const successful = results.filter(
            (result): result is PromiseFulfilledResult<
                Awaited<ReturnType<typeof acquirePublishingLock>>
            > => result.status === "fulfilled"
        );

        const rejected = results.filter(
            (result) => result.status === "rejected"
        );

        if (successful.length !== 1 || rejected.length !== 1) {
            throw new Error(
                `Expected one lock winner and one rejection; got ${successful.length} winners and ${rejected.length} rejections`
            );
        }

        lock = successful[0]!.value;

        console.log("PASS: Only one publisher acquired the lock");
        console.log("PASS: Concurrent publisher was rejected");

        const during = await mongoose.connection
            .collection("apiversions")
            .findOne({ _id: new mongoose.Types.ObjectId(version.versionId) });

        if (
            during?.status !== "publishing" ||
            during.publishingToken !== lock.publishingToken
        ) {
            throw new Error("Publishing lock state is incorrect");
        }

        console.log("PASS: MongoDB contains the winning lock");
    } finally {
        if (lock) {
            await releasePublishingLock({
                ...version,
                publishingToken: lock.publishingToken,
            });
        }

        await mongoose.disconnect();
    }

    console.log("PASS: Lock released successfully");
}

main().catch((error) => {
    console.error("Concurrent publishing test failed:", error);
    process.exitCode = 1;
});