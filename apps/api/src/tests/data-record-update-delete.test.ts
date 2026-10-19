
import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";

import APIDataRecord from "../models/APIDataRecord.js";

import {
    updateDataRecord,
    deleteDataRecord,
} from "../runtime/services/data-record.service.js";

import { verifyTestDatabase } from "./helpers/test-database.js";

const newId = () => new mongoose.Types.ObjectId().toString();

test("P4 UPDATE and DELETE: isolated database tests", async (t) => {
    if (process.env.NODE_ENV !== "test") {
        throw new Error("Tests require NODE_ENV=test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri || new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Unsafe test database URI");
    }

    const scope = {
        organizationId: newId(),
        projectId: newId(),
        apiId: newId(),
        apiVersionId: newId(),
        modelId: newId(),
    };

    const fields = [
        {
            name: "name",
            type: "string" as const,
            required: true,
            unique: false,
        },
        {
            name: "age",
            type: "number" as const,
            required: false,
            unique: false,
        },
    ];

    const createdIds: mongoose.Types.ObjectId[] = [];

    await mongoose.connect(uri);

    try {
        verifyTestDatabase();

        const records = await APIDataRecord.insertMany([
            { ...scope, data: { name: "Alice", age: 25 } },
            { ...scope, data: { name: "Bob", age: 30 } },
        ]);

        createdIds.push(...records.map((record) => record._id));

        await t.test("PATCH updates only supplied fields", async () => {
            const updated = await updateDataRecord({
                scope,
                recordId: records[0]._id.toString(),
                fields,
                body: { name: "Alice Updated" },
            });

            assert.ok(updated);
            assert.equal(updated.data.name, "Alice Updated");
            assert.equal(updated.data.age, 25);
        });

        await t.test("rejects unknown update fields", async () => {
            await assert.rejects(
                updateDataRecord({
                    scope,
                    recordId: records[0]._id.toString(),
                    fields,
                    body: { unknown: "value" },
                }),
                /RUNTIME_UNKNOWN_RECORD_FIELD/
            );
        });

        await t.test("rejects MongoDB operator keys", async () => {
            await assert.rejects(
                updateDataRecord({
                    scope,
                    recordId: records[0]._id.toString(),
                    fields,
                    body: { $set: { name: "Injected" } },
                }),
                /RUNTIME_UNKNOWN_RECORD_FIELD/
            );
        });

        await t.test("rejects invalid update types", async () => {
            await assert.rejects(
                updateDataRecord({
                    scope,
                    recordId: records[0]._id.toString(),
                    fields,
                    body: { age: "not-a-number" },
                }),
                /RUNTIME_RECORD_VALIDATION_FAILED/
            );
        });

        await t.test("rejects empty updates", async () => {
            await assert.rejects(
                updateDataRecord({
                    scope,
                    recordId: records[0]._id.toString(),
                    fields,
                    body: {},
                }),
                /RUNTIME_EMPTY_RECORD_UPDATE/
            );
        });

        await t.test("UPDATE cannot cross model scope", async () => {
            const updated = await updateDataRecord({
                scope: { ...scope, modelId: newId() },
                recordId: records[0]._id.toString(),
                fields,
                body: { name: "Forbidden" },
            });

            assert.equal(updated, null);
        });

        await t.test("DELETE removes only the target record", async () => {
            const deleted = await deleteDataRecord({
                scope,
                recordId: records[1]._id.toString(),
            });

            assert.ok(deleted);
            assert.equal(deleted.data.name, "Bob");

            const stillExists = await APIDataRecord.findOne({
                _id: records[0]._id,
                ...scope,
            });

            assert.ok(stillExists);
        });

        await t.test("DELETE cannot cross tenant scope", async () => {
            const deleted = await deleteDataRecord({
                scope: { ...scope, organizationId: newId() },
                recordId: records[0]._id.toString(),
            });

            assert.equal(deleted, null);
        });

        await t.test("rejects invalid DELETE record IDs", async () => {
            await assert.rejects(
                deleteDataRecord({
                    scope,
                    recordId: "invalid-id",
                }),
                /RUNTIME_INVALID_RECORD_ID/
            );
        });
    } finally {
        try {
            verifyTestDatabase();

            if (createdIds.length > 0) {
                await APIDataRecord.deleteMany({
                    _id: { $in: createdIds },
                    ...scope,
                });
            }
        } finally {
            await mongoose.disconnect();
        }
    }
});
