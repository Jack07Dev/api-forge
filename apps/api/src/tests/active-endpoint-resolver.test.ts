import mongoose from "mongoose";
import dotenv from "dotenv";
import assert from "node:assert/strict";
import { test } from "node:test";

import APIVersion from "../models/APIVersion.js";
import APIEndpoint from "../models/APIEndpoint.js";
import { verifyTestDatabase } from "./helpers/test-database.js";
import { resolveActiveEndpoint } from "../runtime/resolvers/active-endpoint.resolver.js";
import type { HTTPMethod } from "../models/APIEndpoint.js";


test("active endpoint resolver integration", async (t) => {
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

    const ids = {
        organizationId: organizationId.toString(),
        projectId: projectId.toString(),
        apiId: apiId.toString(),
    };

    const endpointIds = {
        static: new mongoose.Types.ObjectId(),
        dynamic: new mongoose.Types.ObjectId(),
        archived: new mongoose.Types.ObjectId(),
    };

    const resolve = (method: HTTPMethod, path: string) =>
        resolveActiveEndpoint({ ...ids, method, path });

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        await APIVersion.create({
            _id: versionId,
            ...ids,
            createdBy: userId,
            version: 1,
            versionLabel: "v1",
            status: "active",
            definitionRevision: 0,
        });

        await APIEndpoint.create([
            {
                _id: endpointIds.static,
                ...ids,
                apiVersionId: versionId,
                createdBy: userId,
                name: "Current User",
                method: "GET",
                path: "/users/me",
                status: "draft",
            },
            {
                _id: endpointIds.dynamic,
                ...ids,
                apiVersionId: versionId,
                createdBy: userId,
                name: "Get User",
                method: "GET",
                path: "/users/{id}",
                status: "draft",
            },
            {
                _id: endpointIds.archived,
                ...ids,
                apiVersionId: versionId,
                createdBy: userId,
                name: "Archived Endpoint",
                method: "GET",
                path: "/archived",
                status: "archived",
            },
        ]);

        await t.test("resolves active version", async () => {
            const resolved = await resolve("GET", "/users/123");

            assert.ok(resolved);
            assert.equal(resolved.versionId, versionId.toString());
            assert.equal(resolved.params.id, "123");
        });

        await t.test("prioritizes static routes", async () => {
            const resolved = await resolve("GET", "/users/me");

            assert.ok(resolved);
            assert.equal(
                resolved.endpointId,
                endpointIds.static.toString()
            );
        });

        await t.test("decodes path parameters", async () => {
            const resolved = await resolve("GET", "/users/hello%20world");

            assert.ok(resolved);
            assert.equal(resolved.params.id, "hello world");
        });

        await t.test("rejects malformed encoding", async () => {
            await assert.rejects(
                resolve("GET", "/users/%ZZ"),
                /INVALID_PATH_ENCODING/
            );
        });

        await t.test("rejects unsupported methods", async () => {
            await assert.rejects(
                resolveActiveEndpoint({
                    ...ids,
                    method: "OPTIONS" as HTTPMethod,
                    path: "/users/me",
                }),
                /INVALID_HTTP_METHOD/
            );
        });

        await t.test("rejects invalid paths", async () => {
            await assert.rejects(
                resolve("GET", "/users//me"),
                /INVALID_ENDPOINT_PATH/
            );
        });

        await t.test("excludes archived endpoints", async () => {
            assert.equal(await resolve("GET", "/archived"), null);
        });

        await t.test("isolates organizations", async () => {
            const resolved = await resolveActiveEndpoint({
                ...ids,
                organizationId: new mongoose.Types.ObjectId().toString(),
                method: "GET",
                path: "/users/me",
            });

            assert.equal(resolved, null);
        });

        await t.test("isolates projects", async () => {
            const resolved = await resolveActiveEndpoint({
                ...ids,
                projectId: new mongoose.Types.ObjectId().toString(),
                method: "GET",
                path: "/users/me",
            });

            assert.equal(resolved, null);
        });

        await t.test("does not resolve inactive versions", async () => {
            for (const status of [
                "draft",
                "publishing",
                "deprecated",
                "archived",
            ] as const) {
                await APIVersion.updateOne(
                    { _id: versionId, ...ids },
                    { $set: { status } }
                );

                assert.equal(
                    await resolve("GET", "/users/me"),
                    null,
                    `Version status ${status} must not resolve`
                );
            }
        });
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIEndpoint.deleteMany({
                _id: { $in: Object.values(endpointIds) },
                ...ids,
                apiVersionId: versionId,
            });

            await APIVersion.deleteOne({
                _id: versionId,
                ...ids,
            });
        }

        await mongoose.disconnect();
    }
});