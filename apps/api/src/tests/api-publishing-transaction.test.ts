import mongoose from "mongoose";
import dotenv from "dotenv";
import assert from "node:assert/strict";
import { test } from "node:test";

import APIVersion from "../models/APIVersion.js";
import { activateAPIVersion } from "../services/api-version.service.js";
import { verifyTestDatabase } from "./helpers/test-database.js";
import { recoverStalePublishingLock } from "../services/api-publishing.service.js";


test("expired publishing lock must reject activation", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("MONGODB_URI missing in .env.test");
    }

    if (new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const versionId = new mongoose.Types.ObjectId();

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        // Use an isolated API ID and version ID for this test.
        await APIVersion.create({
            _id: versionId,
            organizationId,
            projectId,
            apiId,
            createdBy: userId,
            version: 1,
            versionLabel: "v1",
            status: "publishing",
            definitionRevision: 0,
            publishingToken: "expired-test-token",
            publishingStartedAt: new Date(
                Date.now() - 11 * 60 * 1000
            ),
        });

        await assert.rejects(
            activateAPIVersion({
                versionId: versionId.toString(),
                organizationId: organizationId.toString(),
                projectId: projectId.toString(),
                apiId: apiId.toString(),
                publishingToken: "expired-test-token",
                definitionRevision: 0,
            }),
            /Publishing lock is invalid, expired/
        );

        const storedVersion = await APIVersion.findById(versionId);

        assert.equal(storedVersion?.status, "publishing");
        assert.equal(
            storedVersion?.publishingToken,
            "expired-test-token"
        );

        console.log("Expired publishing lock correctly rejected");
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteOne({ _id: versionId });
        }

        await mongoose.disconnect();
    }
});

test("incorrect publishing token must reject activation", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("MONGODB_URI missing in .env.test");
    }

    if (new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const versionId = new mongoose.Types.ObjectId();

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        await APIVersion.create({
            _id: versionId,
            organizationId,
            projectId,
            apiId,
            createdBy: userId,
            version: 1,
            versionLabel: "v1",
            status: "publishing",
            definitionRevision: 0,
            publishingToken: "correct-test-token",
            publishingStartedAt: new Date(),
        });

        await assert.rejects(
            activateAPIVersion({
                versionId: versionId.toString(),
                organizationId: organizationId.toString(),
                projectId: projectId.toString(),
                apiId: apiId.toString(),
                publishingToken: "incorrect-test-token",
                definitionRevision: 0,
            }),
            /Publishing lock is invalid, expired/
        );

        const storedVersion = await APIVersion.findById(versionId);

        assert.equal(storedVersion?.status, "publishing");
        assert.equal(
            storedVersion?.publishingToken,
            "correct-test-token"
        );

        console.log("Incorrect publishing token correctly rejected");
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteOne({ _id: versionId });
        }

        await mongoose.disconnect();
    }
});

test("failed activation must preserve previous active version", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("MONGODB_URI missing in .env.test");
    }

    if (new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const activeVersionId = new mongoose.Types.ObjectId();
    const replacementVersionId = new mongoose.Types.ObjectId();

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        await APIVersion.create([
            {
                _id: activeVersionId,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 1,
                versionLabel: "v1",
                status: "active",
                definitionRevision: 0,
            },
            {
                _id: replacementVersionId,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 2,
                versionLabel: "v2",
                status: "publishing",
                definitionRevision: 0,
                publishingToken: "replacement-test-token",
                publishingStartedAt: new Date(),
            },
        ]);

        // Deliberately provide an incorrect token.
        await assert.rejects(
            activateAPIVersion({
                versionId: replacementVersionId.toString(),
                organizationId: organizationId.toString(),
                projectId: projectId.toString(),
                apiId: apiId.toString(),
                publishingToken: "wrong-token",
                definitionRevision: 0,
            }),
            /Publishing lock is invalid, expired/
        );

        const oldVersion = await APIVersion.findById(activeVersionId);
        const replacement = await APIVersion.findById(replacementVersionId);

        assert.equal(oldVersion?.status, "active");
        assert.equal(replacement?.status, "publishing");
        assert.equal(
            replacement?.publishingToken,
            "replacement-test-token"
        );

        console.log("Previous active version preserved");
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteMany({
                _id: {
                    $in: [activeVersionId, replacementVersionId],
                },
                apiId,
                organizationId,
                projectId,
            });
        }

        await mongoose.disconnect();
    }
});

test("transaction rollback restores deprecated version", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("MONGODB_URI missing in .env.test");
    }

    if (new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const activeVersionId = new mongoose.Types.ObjectId();
    const replacementVersionId = new mongoose.Types.ObjectId();

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        await APIVersion.create([
            {
                _id: activeVersionId,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 1,
                versionLabel: "v1",
                status: "active",
                definitionRevision: 0,
            },
            {
                _id: replacementVersionId,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 2,
                versionLabel: "v2",
                status: "publishing",
                definitionRevision: 0,
                publishingToken: "rollback-test-token",
                publishingStartedAt: new Date(),
            },
        ]);

        // Simulate a failure after the first transaction write.
        await assert.rejects(
            mongoose.connection.transaction(async (session) => {
                const previousVersion =
                    await APIVersion.findById(activeVersionId).session(session);

                assert.ok(previousVersion);

                previousVersion.status = "deprecated";

                await previousVersion.save({ session });

                // Verify the change is visible inside the transaction.
                const changedVersion =
                    await APIVersion.findById(activeVersionId).session(session);

                assert.equal(changedVersion?.status, "deprecated");

                // Simulate activation failing after deprecation.
                throw new Error("Simulated activation failure");
            }),
            /Simulated activation failure/
        );

        // MongoDB must roll back the deprecation.
        const oldVersion = await APIVersion.findById(activeVersionId);
        const replacement = await APIVersion.findById(replacementVersionId);

        assert.equal(oldVersion?.status, "active");
        assert.equal(replacement?.status, "publishing");
        assert.equal(
            replacement?.publishingToken,
            "rollback-test-token"
        );

        console.log("Transaction rollback verified successfully");
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteMany({
                _id: {
                    $in: [activeVersionId, replacementVersionId],
                },
                apiId,
                organizationId,
                projectId,
            });
        }

        await mongoose.disconnect();
    }
});

test("unique index prevents concurrent publishing versions", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("MONGODB_URI missing in .env.test");
    }

    if (new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const version1Id = new mongoose.Types.ObjectId();
    const version2Id = new mongoose.Types.ObjectId();

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        // Confirm the required index exists before writing.
        const indexes = await APIVersion.collection.indexes();

        const publishingIndex = indexes.find(
            (index) => index.name === "unique_publishing_version_per_api"
        );

        assert.equal(publishingIndex?.unique, true);
        assert.deepEqual(publishingIndex?.partialFilterExpression, {
            status: "publishing",
        });

        // Create two draft versions belonging to the same API.
        await APIVersion.create([
            {
                _id: version1Id,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 1,
                versionLabel: "v1",
                status: "draft",
                definitionRevision: 0,
            },
            {
                _id: version2Id,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 2,
                versionLabel: "v2",
                status: "draft",
                definitionRevision: 0,
            },
        ]);

        // Attempt to acquire two publishing states concurrently.
        const results = await Promise.allSettled([
            APIVersion.updateOne(
                { _id: version1Id, status: "draft" },
                {
                    $set: {
                        status: "publishing",
                        publishingToken: "concurrent-token-1",
                        publishingStartedAt: new Date(),
                    },
                }
            ),
            APIVersion.updateOne(
                { _id: version2Id, status: "draft" },
                {
                    $set: {
                        status: "publishing",
                        publishingToken: "concurrent-token-2",
                        publishingStartedAt: new Date(),
                    },
                }
            ),
        ]);

        const successful = results.filter(
            (result) => result.status === "fulfilled"
        );

        const rejected = results.filter(
            (result) => result.status === "rejected"
        );

        assert.equal(successful.length, 1);
        assert.equal(rejected.length, 1);

        const duplicateError = rejected[0];

        assert.equal(duplicateError?.status, "rejected");

        if (duplicateError?.status === "rejected") {
            assert.equal(duplicateError.reason?.code, 11000);
        }

        const publishingVersions = await APIVersion.find({
            apiId,
            organizationId,
            projectId,
            status: "publishing",
        });

        assert.equal(publishingVersions.length, 1);

        console.log("Concurrent publishing correctly restricted to one version");
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteMany({
                _id: { $in: [version1Id, version2Id] },
                apiId,
                organizationId,
                projectId,
            });
        }

        await mongoose.disconnect();
    }
});

test("concurrent activation of same version preserves consistency", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri || new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const activeVersionId = new mongoose.Types.ObjectId();
    const replacementVersionId = new mongoose.Types.ObjectId();

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        await APIVersion.create([
            {
                _id: activeVersionId,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 1,
                versionLabel: "v1",
                status: "active",
                definitionRevision: 0,
            },
            {
                _id: replacementVersionId,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 2,
                versionLabel: "v2",
                status: "publishing",
                definitionRevision: 0,
                publishingToken: "concurrent-activation-token",
                publishingStartedAt: new Date(),
            },
        ]);

        const input = {
            versionId: replacementVersionId.toString(),
            organizationId: organizationId.toString(),
            projectId: projectId.toString(),
            apiId: apiId.toString(),
            publishingToken: "concurrent-activation-token",
            definitionRevision: 0,
        };

        const results = await Promise.allSettled([
            activateAPIVersion(input),
            activateAPIVersion(input),
        ]);

        const successful = results.filter(
            (result) => result.status === "fulfilled"
        );

        const rejected = results.filter(
            (result) => result.status === "rejected"
        );

        assert.equal(
            successful.length,
            1,
            "Exactly one activation should succeed"
        );

        assert.equal(
            rejected.length,
            1,
            "The competing activation should fail"
        );

        const versions = await APIVersion.find({
            apiId,
            organizationId,
            projectId,
        });

        const activeVersions = versions.filter(
            (version) => version.status === "active"
        );

        assert.equal(activeVersions.length, 1);
        assert.equal(
            activeVersions[0]?._id.toString(),
            replacementVersionId.toString()
        );

        const oldVersion = versions.find(
            (version) =>
                version._id.toString() === activeVersionId.toString()
        );

        assert.equal(oldVersion?.status, "deprecated");

        console.log("Concurrent activation preserved one active version");
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteMany({
                _id: {
                    $in: [activeVersionId, replacementVersionId],
                },
                apiId,
                organizationId,
                projectId,
            });
        }

        await mongoose.disconnect();
    }
});

test("unique index prevents multiple active versions", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri || new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const version1Id = new mongoose.Types.ObjectId();
    const version2Id = new mongoose.Types.ObjectId();

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        // Verify the unique active-version index exists.
        const indexes = await APIVersion.collection.indexes();

        const activeIndex = indexes.find(
            (index) => index.name === "unique_active_version_per_api"
        );

        assert.equal(activeIndex?.unique, true);
        assert.deepEqual(activeIndex?.partialFilterExpression, {
            status: "active",
        });

        // Create an active version and a draft replacement.
        await APIVersion.create([
            {
                _id: version1Id,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 1,
                versionLabel: "v1",
                status: "active",
                definitionRevision: 0,
            },
            {
                _id: version2Id,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 2,
                versionLabel: "v2",
                status: "draft",
                definitionRevision: 0,
            },
        ]);

        // Attempt to activate v2 without deprecating v1.
        await assert.rejects(
            APIVersion.updateOne(
                {
                    _id: version2Id,
                    apiId,
                    status: "draft",
                },
                {
                    $set: { status: "active" },
                }
            ),
            (error: unknown) => {
                return (
                    typeof error === "object" &&
                    error !== null &&
                    "code" in error &&
                    error.code === 11000
                );
            }
        );

        const versions = await APIVersion.find({
            apiId,
            organizationId,
            projectId,
        });

        const activeVersions = versions.filter(
            (version) => version.status === "active"
        );

        assert.equal(activeVersions.length, 1);
        assert.equal(
            activeVersions[0]?._id.toString(),
            version1Id.toString()
        );

        const replacement = versions.find(
            (version) =>
                version._id.toString() === version2Id.toString()
        );

        assert.equal(replacement?.status, "draft");

        console.log("Duplicate active version correctly rejected");
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteMany({
                _id: { $in: [version1Id, version2Id] },
                apiId,
                organizationId,
                projectId,
            });
        }

        await mongoose.disconnect();
    }
});

test("competing API version cannot activate without publishing ownership", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri || new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const version1Id = new mongoose.Types.ObjectId();
    const version2Id = new mongoose.Types.ObjectId();

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        await APIVersion.create([
            {
                _id: version1Id,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 1,
                versionLabel: "v1",
                status: "publishing",
                definitionRevision: 0,
                publishingToken: "owner-token",
                publishingStartedAt: new Date(),
            },
            {
                _id: version2Id,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 2,
                versionLabel: "v2",
                status: "draft",
                definitionRevision: 0,
            },
        ]);

        const results = await Promise.allSettled([
            activateAPIVersion({
                versionId: version1Id.toString(),
                organizationId: organizationId.toString(),
                projectId: projectId.toString(),
                apiId: apiId.toString(),
                publishingToken: "owner-token",
                definitionRevision: 0,
            }),
            activateAPIVersion({
                versionId: version2Id.toString(),
                organizationId: organizationId.toString(),
                projectId: projectId.toString(),
                apiId: apiId.toString(),
                publishingToken: "competing-token",
                definitionRevision: 0,
            }),
        ]);

        assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1
        );

        assert.equal(
            results.filter((result) => result.status === "rejected").length,
            1
        );

        const versions = await APIVersion.find({
            apiId,
            organizationId,
            projectId,
        });

        assert.equal(
            versions.filter((version) => version.status === "active").length,
            1
        );

        assert.equal(
            versions.find((version) => version.id === version1Id.toString())?.status,
            "active"
        );

        assert.equal(
            versions.find((version) => version.id === version2Id.toString())?.status,
            "draft"
        );

        console.log("Competing version correctly blocked from activation");
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteMany({
                _id: { $in: [version1Id, version2Id] },
                apiId,
                organizationId,
                projectId,
            });
        }

        await mongoose.disconnect();
    }
});

test("lock expiration before final activation rolls back transaction", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri || new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const activeVersionId = new mongoose.Types.ObjectId();
    const replacementVersionId = new mongoose.Types.ObjectId();

    const publishingToken = "expiration-during-activation-token";

    try {
        // Connect only to the isolated test database.
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        // Create v1 (active) and v2 (publishing).
        await APIVersion.create([
            {
                _id: activeVersionId,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 1,
                versionLabel: "v1",
                status: "active",
                definitionRevision: 0,
            },
            {
                _id: replacementVersionId,
                organizationId,
                projectId,
                apiId,
                createdBy: userId,
                version: 2,
                versionLabel: "v2",
                status: "publishing",
                definitionRevision: 0,
                publishingToken,
                publishingStartedAt: new Date(),
            },
        ]);

        // First call: current time (valid publishing lock).
        // Second call: 11 minutes later (expired publishing lock).
        const initialTime = Date.now();
        let clockCalls = 0;

        const now = () => {
            clockCalls += 1;

            return clockCalls === 1
                ? initialTime
                : initialTime + 11 * 60 * 1000;
        };

        // Activation should fail after the clock advances.
        await assert.rejects(
            activateAPIVersion({
                versionId: replacementVersionId.toString(),
                organizationId: organizationId.toString(),
                projectId: projectId.toString(),
                apiId: apiId.toString(),
                publishingToken,
                definitionRevision: 0,
                now,
            }),
            /Publishing lock expired or ownership changed/
        );

        // Both lock checks must have executed.
        assert.ok(clockCalls >= 2);

        // The failed transaction must preserve both versions.
        const oldVersion = await APIVersion.findById(activeVersionId);
        const replacement = await APIVersion.findById(
            replacementVersionId
        );

        assert.equal(oldVersion?.status, "active");
        assert.equal(replacement?.status, "publishing");
        assert.equal(replacement?.publishingToken, publishingToken);

        console.log(
            "Expired lock rejected and transaction rolled back"
        );
    } finally {
        // Delete only the records created by this test.
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteMany({
                _id: {
                    $in: [
                        activeVersionId,
                        replacementVersionId,
                    ],
                },
                apiId,
                organizationId,
                projectId,
            });
        }

        await mongoose.disconnect();
    }
});

test("recovery cannot release a lock renewed by heartbeat", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    if (result.error) {
        throw new Error("Unable to load .env.test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri || new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const versionId = new mongoose.Types.ObjectId();

    const publishingToken = "recovery-heartbeat-race-token";

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        // Simulate a stale lock discovered by the recovery worker.
        await APIVersion.create({
            _id: versionId,
            organizationId,
            projectId,
            apiId,
            createdBy: userId,
            version: 1,
            versionLabel: "v1",
            status: "publishing",
            definitionRevision: 0,
            publishingToken,
            publishingStartedAt: new Date(Date.now() - 11 * 60 * 1000),
        });

        // Simulate a concurrent renewal before recovery executes.
        // This uses a direct DB update because renewPublishingLock()
        // correctly refuses to renew an already-expired lock.
        const renewal = await APIVersion.updateOne(
            {
                _id: versionId,
                apiId,
                projectId,
                organizationId,
                status: "publishing",
                publishingToken,
            },
            {
                $set: {
                    publishingStartedAt: new Date(),
                },
            }
        );

        assert.equal(renewal.matchedCount, 1);

        const recovery = await recoverStalePublishingLock({
            versionId: versionId.toString(),
            organizationId: organizationId.toString(),
            projectId: projectId.toString(),
            apiId: apiId.toString(),
        });

        assert.equal(recovery.recovered, false);

        const storedVersion = await APIVersion.findById(versionId);

        assert.equal(storedVersion?.status, "publishing");
        assert.equal(storedVersion?.publishingToken, publishingToken);

        console.log("Recovery correctly preserved renewed publishing lock");
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIVersion.deleteOne({
                _id: versionId,
                apiId,
                projectId,
                organizationId,
            });
        }

        await mongoose.disconnect();
    }
});