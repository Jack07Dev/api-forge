
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";

import app from "../app.js";
import { env } from "../config/env.js";

import User from "../models/User.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import Project from "../models/Project.js";
import API from "../models/API.js";
import APIVersion from "../models/APIVersion.js";
import APIEndpoint from "../models/APIEndpoint.js";
import APIModel from "../models/APIModel.js";
import APIEndpointDataSource from "../models/APIEndpointDataSource.js";
import APIDataRecord from "../models/APIDataRecord.js";

import { verifyTestDatabase } from "./helpers/test-database.js";

const TEST_DB = "api_forge_test";

const verifyEnvironment = () => {
    if (process.env.NODE_ENV !== "test") {
        throw new Error("HTTP tests require NODE_ENV=test");
    }

    const uri = process.env.MONGODB_URI;

    if (!uri || new URL(uri).pathname !== `/${TEST_DB}`) {
        throw new Error("HTTP tests require api_forge_test");
    }
};

test("P4.5: authenticated database runtime HTTP", async (t) => {
    verifyEnvironment();

    await mongoose.connect(process.env.MONGODB_URI!);
    verifyTestDatabase();

    const ids = {
        user: new mongoose.Types.ObjectId(),
        outsider: new mongoose.Types.ObjectId(),
        organization: new mongoose.Types.ObjectId(),
        project: new mongoose.Types.ObjectId(),
        api: new mongoose.Types.ObjectId(),
        version: new mongoose.Types.ObjectId(),
        model: new mongoose.Types.ObjectId(),
    };

    const endpointIds: mongoose.Types.ObjectId[] = [];
    const token = jwt.sign(
        { userId: String(ids.user), role: "user" },
        env.jwtSecret,
        { expiresIn: "1h" }
    );

    const outsiderToken = jwt.sign(
        { userId: String(ids.outsider), role: "user" },
        env.jwtSecret,
        { expiresIn: "1h" }
    );

    const cookie = `token=${token}`;
    const outsiderCookie = `token=${outsiderToken}`;

    const base =
        `/api/organizations/${ids.organization}` +
        `/projects/${ids.project}` +
        `/apis/${ids.api}/runtime/execute/data`;

    const unique = ids.organization.toString();

    const execute = (
        method: string,
        path: string,
        body?: unknown,
        query?: Record<string, string>
    ) =>
        request(app)
            .post(base)
            .set("Cookie", cookie)
            .send({ method, path, body, query });

    try {
        await User.create([
            {
                _id: ids.user,
                name: "Runtime Tester",
                email: `runtime-${unique}@example.test`,
                password: "test-password-123",
            },
            {
                _id: ids.outsider,
                name: "Outside Tester",
                email: `outsider-${unique}@example.test`,
                password: "test-password-123",
            },
        ]);

        await Organization.create({
            _id: ids.organization,
            name: "Runtime Test Organization",
            slug: `runtime-org-${unique}`,
            ownerId: ids.user,
            isActive: true,
        });

        await OrganizationMember.create({
            organizationId: ids.organization,
            userId: ids.user,
            role: "owner",
        });

        await Project.create({
            _id: ids.project,
            name: "Runtime Test Project",
            slug: `runtime-project-${unique}`,
            organizationId: ids.organization,
            createdBy: ids.user,
            status: "active",
        });

        await API.create({
            _id: ids.api,
            name: "Runtime Test API",
            slug: `runtime-api-${unique}`,
            organizationId: ids.organization,
            projectId: ids.project,
            createdBy: ids.user,
            status: "active",
        });

        await APIVersion.create({
            _id: ids.version,
            organizationId: ids.organization,
            projectId: ids.project,
            apiId: ids.api,
            version: 1,
            versionLabel: "v1",
            definitionRevision: 1,
            status: "active",
            createdBy: ids.user,
        });

        await APIModel.create({
            _id: ids.model,
            name: "Runtime User",
            slug: "runtime-user",
            organizationId: ids.organization,
            projectId: ids.project,
            apiId: ids.api,
            versionId: ids.version,
            status: "active",
            createdBy: ids.user,
            fields: [
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
            ],
        });

        const endpointConfigs = [
            { method: "POST", path: "/users", operation: "create" },
            { method: "GET", path: "/users", operation: "findMany" },
            { method: "GET", path: "/users/{id}", operation: "findOne" },
            { method: "PATCH", path: "/users/{id}", operation: "update" },
            { method: "DELETE", path: "/users/{id}", operation: "delete" },
        ] as const;

        for (const config of endpointConfigs) {
            const endpointId = new mongoose.Types.ObjectId();
            endpointIds.push(endpointId);

            await APIEndpoint.create({
                _id: endpointId,
                organizationId: ids.organization,
                projectId: ids.project,
                apiId: ids.api,
                apiVersionId: ids.version,
                name: `${config.method} ${config.path}`,
                method: config.method,
                path: config.path,
                status: "active",
                createdBy: ids.user,
            });

            await APIEndpointDataSource.create({
                organizationId: ids.organization,
                projectId: ids.project,
                apiId: ids.api,
                apiVersionId: ids.version,
                endpointId,
                modelId: ids.model,
                operation: config.operation,
                status: "active",
                createdBy: ids.user,
            });
        }

        let recordId = "";

        await t.test("rejects unauthenticated requests", async () => {
            const response = await request(app)
                .post(base)
                .send({ method: "GET", path: "/users" });

            assert.equal(response.status, 401);
        });

        await t.test("rejects non-members", async () => {
            const response = await request(app)
                .post(base)
                .set("Cookie", outsiderCookie)
                .send({ method: "GET", path: "/users" });

            assert.equal(response.status, 403);
        });

        await t.test("creates a database record", async () => {
            const response = await execute(
                "POST",
                "/users",
                { name: "Alice", age: 25 }
            );

            assert.equal(response.status, 201);
            assert.equal(response.body.success, true);
            assert.equal(response.body.data.data.name, "Alice");

            recordId = response.body.data._id;
            assert.ok(mongoose.isObjectIdOrHexString(recordId));
        });

        await t.test("reads a record list", async () => {
            const response = await execute(
                "GET",
                "/users",
                undefined,
                { limit: "10", skip: "0" }
            );

            assert.equal(response.status, 200);
            assert.ok(Array.isArray(response.body.data));
            assert.ok(
                response.body.data.some(
                    (record: { _id: string }) => record._id === recordId
                )
            );
        });

        await t.test("reads a single record", async () => {
            const response = await execute(
                "GET",
                `/users/${recordId}`
            );

            assert.equal(response.status, 200);
            assert.equal(response.body.data._id, recordId);
        });

        await t.test("rejects unknown fields", async () => {
            const response = await execute(
                "POST",
                "/users",
                { name: "Bob", unknownField: true }
            );

            assert.equal(response.status, 400);
        });

        await t.test("rejects invalid pagination", async () => {
            const response = await execute(
                "GET",
                "/users",
                undefined,
                { limit: "-1" }
            );

            assert.equal(response.status, 400);
        });

        await t.test("updates a record", async () => {
            const response = await execute(
                "PATCH",
                `/users/${recordId}`,
                { age: 26 }
            );

            assert.equal(response.status, 200);
            assert.equal(response.body.data.data.age, 26);
            assert.equal(response.body.data.data.name, "Alice");
        });

        await t.test("returns 404 for missing record", async () => {
            const missingId = new mongoose.Types.ObjectId();

            const response = await execute(
                "GET",
                `/users/${missingId}`
            );

            assert.equal(response.status, 404);
        });

        await t.test("deletes a record", async () => {
            const response = await execute(
                "DELETE",
                `/users/${recordId}`
            );

            assert.equal(response.status, 200);
            assert.equal(response.body.success, true);
        });

        await t.test("deleted record is no longer available", async () => {
            const response = await execute(
                "GET",
                `/users/${recordId}`
            );

            assert.equal(response.status, 404);
        });

        await t.test("rejects unsupported PUT runtime", async () => {
            const response = await execute(
                "PUT",
                `/users/${new mongoose.Types.ObjectId()}`,
                { name: "Replacement" }
            );

            assert.equal(response.status, 400);
        });
    } finally {
        // Never perform cleanup unless the test DB is verified.
        verifyTestDatabase();

        await APIDataRecord.deleteMany({
            organizationId: ids.organization,
            projectId: ids.project,
            apiId: ids.api,
            apiVersionId: ids.version,
            modelId: ids.model,
        });

        await APIEndpointDataSource.deleteMany({
            endpointId: { $in: endpointIds },
            organizationId: ids.organization,
        });

        await APIEndpoint.deleteMany({
            _id: { $in: endpointIds },
            organizationId: ids.organization,
        });

        await APIModel.deleteOne({ _id: ids.model });
        await APIVersion.deleteOne({ _id: ids.version });
        await API.deleteOne({ _id: ids.api });
        await Project.deleteOne({ _id: ids.project });

        await OrganizationMember.deleteMany({
            organizationId: ids.organization,
            userId: ids.user,
        });

        await Organization.deleteOne({ _id: ids.organization });

        await User.deleteMany({
            _id: { $in: [ids.user, ids.outsider] },
        });

        await mongoose.disconnect();
    }
});
