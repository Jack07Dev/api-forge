
import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";

import APIDataRecord from "../models/APIDataRecord.js";
import { createDataRecord } from "../runtime/services/data-record.service.js";
import { verifyTestDatabase } from "./helpers/test-database.js";

import type { IAPIModelField } from "../models/APIModel.js";

const TEST_DB_NAME = "api_forge_test";

const fields: IAPIModelField[] = [
    {
        name: "name",
        type: "string",
        required: true,
        unique: false,
    },
    {
        name: "age",
        type: "number",
        required: false,
        unique: false,
    },
];

const makeScope = () => ({
    organizationId: new mongoose.Types.ObjectId().toString(),
    projectId: new mongoose.Types.ObjectId().toString(),
    apiId: new mongoose.Types.ObjectId().toString(),
    apiVersionId: new mongoose.Types.ObjectId().toString(),
    modelId: new mongoose.Types.ObjectId().toString(),
});

test("P4 CREATE: isolated database tests", async (t) => {
    // Check environment before opening a connection.
    if (process.env.NODE_ENV !== "test") {
        throw new Error("Tests require NODE_ENV=test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("MONGODB_URI is required");
    }

    // Verify the database in the URI before connecting.
    const databaseName = new URL(uri).pathname.slice(1);

    if (databaseName !== TEST_DB_NAME) {
        throw new Error(
            `Unsafe test database URI: ${databaseName}`
        );
    }

    await mongoose.connect(uri);

    const scope = makeScope();
    const createdIds: mongoose.Types.ObjectId[] = [];

    try {
        verifyTestDatabase();

        const scope = makeScope();
        const createdIds: mongoose.Types.ObjectId[] = [];


        await t.test("creates a valid record", async () => {
            const result = await createDataRecord({
                scope,
                fields,
                body: {
                    name: "John",
                    age: 28,
                },
            });

            createdIds.push(result._id);

            assert.equal(result.data.name, "John");
            assert.equal(result.data.age, 28);

            const stored = await APIDataRecord.findOne({
                _id: result._id,
                ...scope,
            }).lean();

            assert.ok(stored);
            assert.equal(stored.data.name, "John");
        });

        await t.test("rejects missing required fields", async () => {
            await assert.rejects(
                createDataRecord({
                    scope,
                    fields,
                    body: { age: 28 },
                }),
                /RUNTIME_RECORD_VALIDATION_FAILED/
            );
        });

        await t.test("rejects invalid field types", async () => {
            await assert.rejects(
                createDataRecord({
                    scope,
                    fields,
                    body: {
                        name: "John",
                        age: "twenty-eight",
                    },
                }),
                /RUNTIME_RECORD_VALIDATION_FAILED/
            );
        });

        await t.test("rejects unknown fields", async () => {
            await assert.rejects(
                createDataRecord({
                    scope,
                    fields,
                    body: {
                        name: "John",
                        admin: true,
                    },
                }),
                /RUNTIME_UNKNOWN_RECORD_FIELD/
            );
        });

        await t.test("rejects unsafe field names", async () => {
            await assert.rejects(
                createDataRecord({
                    scope,
                    fields,
                    body: {
                        name: "John",
                        "$set": { admin: true },
                    },
                }),
                /RUNTIME_UNKNOWN_RECORD_FIELD/
            );
        });

        await t.test("rejects invalid scope IDs", async () => {
            await assert.rejects(
                createDataRecord({
                    scope: {
                        ...scope,
                        organizationId: "invalid-id",
                    },
                    fields,
                    body: { name: "John" },
                }),
                /RUNTIME_INVALID_RECORD_SCOPE/
            );
        });

        await t.test("isolates records by organization", async () => {
            const otherOrganizationId =
                new mongoose.Types.ObjectId().toString();

            const found = await APIDataRecord.findOne({
                _id: createdIds[0],
                ...scope,
                organizationId: otherOrganizationId,
            }).lean();

            assert.equal(found, null);
        });

        await t.test("isolates records by API version", async () => {
            const otherVersionId =
                new mongoose.Types.ObjectId().toString();

            const found = await APIDataRecord.findOne({
                _id: createdIds[0],
                ...scope,
                apiVersionId: otherVersionId,
            }).lean();

            assert.equal(found, null);
        });

        await t.test("isolates records by model", async () => {
            const otherModelId =
                new mongoose.Types.ObjectId().toString();

            const found = await APIDataRecord.findOne({
                _id: createdIds[0],
                ...scope,
                modelId: otherModelId,
            }).lean();

            assert.equal(found, null);
        });
    } finally {
        try {
            verifyTestDatabase();

            if (createdIds.length > 0) {
                await APIDataRecord.deleteMany({
                    _id: { $in: createdIds },
                    organizationId: scope.organizationId,
                    projectId: scope.projectId,
                    apiId: scope.apiId,
                    apiVersionId: scope.apiVersionId,
                    modelId: scope.modelId,
                });
            }
        } finally {
            await mongoose.disconnect();
        }
    }
});
