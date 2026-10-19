
import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";

import APIDataRecord from "../models/APIDataRecord.js";
import {
    findManyDataRecords,
    findOneDataRecord,
} from "../runtime/services/data-record.service.js";
import { verifyTestDatabase } from "./helpers/test-database.js";

const makeScope = () => ({
    organizationId: new mongoose.Types.ObjectId().toString(),
    projectId: new mongoose.Types.ObjectId().toString(),
    apiId: new mongoose.Types.ObjectId().toString(),
    apiVersionId: new mongoose.Types.ObjectId().toString(),
    modelId: new mongoose.Types.ObjectId().toString(),
});

test("P4 READ: isolated database tests", async (t) => {
    if (process.env.NODE_ENV !== "test") {
        throw new Error("Tests require NODE_ENV=test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri || new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Unsafe test database URI");
    }

    const scope = makeScope();
    const otherScope = {
        ...scope,
        organizationId: new mongoose.Types.ObjectId().toString(),
    };

    const createdIds: mongoose.Types.ObjectId[] = [];

    await mongoose.connect(uri);

    try {
        verifyTestDatabase();

        // Create fixtures only inside the isolated test database.
        const records = await APIDataRecord.insertMany([
            { ...scope, data: { name: "Alice" } },
            { ...scope, data: { name: "Bob" } },
            { ...scope, data: { name: "Charlie" } },
            { ...otherScope, data: { name: "Private" } },
        ]);

        createdIds.push(...records.map((record) => record._id));

        await t.test("findMany returns scoped records", async () => {
            const result = await findManyDataRecords({ scope });

            assert.equal(result.length, 3);
            assert.ok(
                result.every(
                    (record) =>
                        record.organizationId.toString() ===
                        scope.organizationId
                )
            );
        });

        await t.test("findOne returns a matching record", async () => {
            const result = await findOneDataRecord({
                scope,
                recordId: records[0]._id.toString(),
            });

            assert.ok(result);
            assert.equal(result.data.name, "Alice");
        });

        await t.test("findOne rejects cross-tenant access", async () => {
            const result = await findOneDataRecord({
                scope,
                recordId: records[3]._id.toString(),
            });

            assert.equal(result, null);
        });

        await t.test("findMany excludes other tenants", async () => {
            const result = await findManyDataRecords({ scope });

            assert.ok(
                result.every(
                    (record) => record.data.name !== "Private"
                )
            );
        });

        await t.test("supports pagination", async () => {
            const result = await findManyDataRecords({
                scope,
                limit: 2,
                skip: 1,
            });

            assert.equal(result.length, 2);
        });

        await t.test("rejects invalid record IDs", async () => {
            await assert.rejects(
                findOneDataRecord({
                    scope,
                    recordId: "invalid-id",
                }),
                /RUNTIME_INVALID_RECORD_ID/
            );
        });

        await t.test("rejects invalid scope", async () => {
            await assert.rejects(
                findManyDataRecords({
                    scope: {
                        ...scope,
                        apiId: "invalid-id",
                    },
                }),
                /RUNTIME_INVALID_RECORD_SCOPE/
            );
        });

        await t.test("rejects invalid pagination", async () => {
            await assert.rejects(
                findManyDataRecords({ scope, limit: 101 }),
                /RUNTIME_INVALID_RECORD_LIMIT/
            );

            await assert.rejects(
                findManyDataRecords({ scope, skip: -1 }),
                /RUNTIME_INVALID_RECORD_SKIP/
            );
        });

        await t.test("findOne returns null for missing records", async () => {
            const result = await findOneDataRecord({
                scope,
                recordId: new mongoose.Types.ObjectId().toString(),
            });

            assert.equal(result, null);
        });
    } finally {
        try {
            verifyTestDatabase();

            if (createdIds.length > 0) {
                await APIDataRecord.deleteMany({
                    _id: { $in: createdIds },
                    organizationId: {
                        $in: [
                            scope.organizationId,
                            otherScope.organizationId,
                        ]
                    },
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
