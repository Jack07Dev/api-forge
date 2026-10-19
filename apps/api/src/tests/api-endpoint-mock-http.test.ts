
import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";

test("P1 mock configuration CRUD HTTP integration", async (t) => {
    const uri = process.env.MONGODB_URI;
    const secret = process.env.JWT_SECRET;

    // Never run against development or production databases.
    if (
        process.env.NODE_ENV !== "test" ||
        !uri ||
        new URL(uri).pathname !== "/api_forge_test" ||
        !secret
    ) {
        throw new Error("Test blocked: unsafe test environment");
    }

    const { default: app } = await import("../app.js");
    const { default: Organization } =
        await import("../models/Organization.js");
    const { default: OrganizationMember } =
        await import("../models/OrganizationMember.js");
    const { default: APIVersion } =
        await import("../models/APIVersion.js");
    const { default: APIEndpoint } =
        await import("../models/APIEndpoint.js");
    const { default: APIEndpointMockResponse } =
        await import("../models/APIEndpointMockResponse.js");
    const { verifyTestDatabase } =
        await import("./helpers/test-database.js");

    const userId = new mongoose.Types.ObjectId();
    const developerId = new mongoose.Types.ObjectId();
    const outsiderId = new mongoose.Types.ObjectId();

    const organizationId = new mongoose.Types.ObjectId();
    const projectId = new mongoose.Types.ObjectId();
    const apiId = new mongoose.Types.ObjectId();
    const versionId = new mongoose.Types.ObjectId();
    const endpointId = new mongoose.Types.ObjectId();

    const scope = {
        organizationId,
        projectId,
        apiId,
    };

    const mockFilter = {
        ...scope,
        apiVersionId: versionId,
        endpointId,
    };

    const url =
        `/api/organizations/${organizationId}` +
        `/projects/${projectId}` +
        `/apis/${apiId}` +
        `/versions/${versionId}` +
        `/endpoints/${endpointId}/mock`;

    const makeToken = (id: mongoose.Types.ObjectId) =>
        jwt.sign(
            { userId: id.toString(), role: "user" },
            secret,
            { expiresIn: "1h" }
        );

    const ownerToken = makeToken(userId);
    const developerToken = makeToken(developerId);
    const outsiderToken = makeToken(outsiderId);

    const initialMock = {
        statusCode: 200,
        responseBody: {
            message: "Initial mock response",
            success: true,
        },
    };

    const updatedMock = {
        statusCode: 201,
        responseBody: {
            message: "Updated mock response",
            success: true,
        },
    };

    const post = (
        body: object,
        token: string = ownerToken,
        targetUrl: string = url
    ) =>
        request(app)
            .post(targetUrl)
            .set("Cookie", `token=${token}`)
            .send(body);

    const get = (
        token: string = ownerToken,
        targetUrl: string = url
    ) =>
        request(app)
            .get(targetUrl)
            .set("Cookie", `token=${token}`);

    const patch = (
        body: object,
        token: string = ownerToken,
        targetUrl: string = url
    ) =>
        request(app)
            .patch(targetUrl)
            .set("Cookie", `token=${token}`)
            .send(body);

    const remove = (
        token: string = ownerToken,
        targetUrl: string = url
    ) =>
        request(app)
            .delete(targetUrl)
            .set("Cookie", `token=${token}`);

    const getRevision = async (): Promise<number> => {
        const version = await APIVersion.findOne({
            _id: versionId,
            ...scope,
        });

        assert.ok(version, "Test API version must exist");
        return version.definitionRevision;
    };

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        // Isolated test fixtures.
        await Organization.create({
            _id: organizationId,
            name: "Mock CRUD HTTP Test Organization",
            slug: `mock-crud-${organizationId}`,
            ownerId: userId,
            isActive: true,
        });

        await OrganizationMember.create({
            organizationId,
            userId,
            role: "owner",
        });

        await OrganizationMember.create({
            organizationId,
            userId: developerId,
            role: "developer",
        });

        await APIVersion.create({
            _id: versionId,
            ...scope,
            version: 1,
            versionLabel: "v1",
            status: "draft",
            definitionRevision: 0,
            createdBy: userId,
        });

        await APIEndpoint.create({
            _id: endpointId,
            ...scope,
            apiVersionId: versionId,
            name: "Get User",
            method: "GET",
            path: "/users/{id}",
            status: "draft",
            createdBy: userId,
        });

        await t.test("GET missing mock returns 404", async () => {
            const response = await get();

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });

        await t.test("POST creates mock response", async () => {
            const before = await getRevision();

            const response = await post(initialMock);

            assert.equal(response.status, 201);
            assert.equal(response.body.success, true);
            assert.equal(response.body.data.statusCode, 200);
            assert.deepEqual(
                response.body.data.responseBody,
                initialMock.responseBody
            );

            assert.equal(await getRevision(), before + 1);
        });

        await t.test("GET returns saved mock", async () => {
            const response = await get();

            assert.equal(response.status, 200);
            assert.equal(response.body.success, true);
            assert.equal(response.body.data.statusCode, 200);
            assert.deepEqual(
                response.body.data.responseBody,
                initialMock.responseBody
            );
        });

        await t.test("POST duplicate returns 409", async () => {
            const before = await getRevision();

            const response = await post(initialMock);

            assert.equal(response.status, 409);
            assert.equal(response.body.success, false);
            assert.equal(await getRevision(), before);
        });

        await t.test("PATCH updates mock", async () => {
            const before = await getRevision();

            const response = await patch(updatedMock);

            assert.equal(response.status, 200);
            assert.equal(response.body.success, true);
            assert.equal(response.body.data.statusCode, 201);
            assert.deepEqual(
                response.body.data.responseBody,
                updatedMock.responseBody
            );

            assert.equal(await getRevision(), before + 1);
        });

        await t.test("GET reflects updated mock", async () => {
            const response = await get();

            assert.equal(response.status, 200);
            assert.equal(response.body.data.statusCode, 201);
            assert.deepEqual(
                response.body.data.responseBody,
                updatedMock.responseBody
            );
        });

        await t.test("GET allows developer member", async () => {
            const response = await get(developerToken);

            assert.equal(response.status, 200);
            assert.equal(response.body.success, true);
        });

        await t.test("POST rejects developer role", async () => {
            const response = await post(
                initialMock,
                developerToken
            );

            assert.equal(response.status, 403);
        });

        await t.test("PATCH rejects developer role", async () => {
            const response = await patch(
                initialMock,
                developerToken
            );

            assert.equal(response.status, 403);
        });

        await t.test("DELETE rejects developer role", async () => {
            const response = await remove(developerToken);

            assert.equal(response.status, 403);
        });

        await t.test("GET rejects outsider", async () => {
            const response = await get(outsiderToken);

            assert.equal(response.status, 403);
        });

        await t.test("POST rejects outsider", async () => {
            const response = await post(
                initialMock,
                outsiderToken
            );

            assert.equal(response.status, 403);
        });

        await t.test("GET rejects missing authentication", async () => {
            const response = await request(app).get(url);

            assert.equal(response.status, 401);
        });

        await t.test("POST rejects missing authentication", async () => {
            const response = await request(app)
                .post(url)
                .send(initialMock);

            assert.equal(response.status, 401);
        });

        await t.test("POST rejects invalid status code", async () => {
            const before = await getRevision();

            const response = await post({
                statusCode: 199,
                responseBody: {},
            });

            assert.equal(response.status, 400);
            assert.equal(await getRevision(), before);
        });

        await t.test("PATCH rejects status 204 with body", async () => {
            const before = await getRevision();

            const response = await patch({
                statusCode: 204,
                responseBody: {},
            });

            assert.equal(response.status, 400);
            assert.equal(await getRevision(), before);
        });

        await t.test("PATCH rejects missing response body", async () => {
            const response = await patch({
                statusCode: 200,
            });

            assert.equal(response.status, 400);
        });

        await t.test("PATCH rejects oversized body", async () => {
            const response = await patch({
                statusCode: 200,
                responseBody: {
                    content: "x".repeat(70 * 1024),
                },
            });

            assert.equal(response.status, 400);
        });

        await t.test("PATCH rejects partial update", async () => {
            const response = await patch({
                statusCode: 202,
            });

            assert.equal(response.status, 400);
        });

        await t.test("GET rejects invalid endpoint ID", async () => {
            const invalidUrl = url.replace(
                endpointId.toString(),
                "invalid-id"
            );

            const response = await get(ownerToken, invalidUrl);

            assert.equal(response.status, 400);
        });

        await t.test("GET rejects wrong project scope", async () => {
            const otherProjectId = new mongoose.Types.ObjectId();

            const wrongUrl = url.replace(
                projectId.toString(),
                otherProjectId.toString()
            );

            const response = await get(ownerToken, wrongUrl);

            assert.equal(response.status, 404);
        });

        await t.test("GET rejects wrong API scope", async () => {
            const otherApiId = new mongoose.Types.ObjectId();

            const wrongUrl = url.replace(
                apiId.toString(),
                otherApiId.toString()
            );

            const response = await get(ownerToken, wrongUrl);

            assert.equal(response.status, 404);
        });

        await t.test("GET rejects wrong version scope", async () => {
            const otherVersionId = new mongoose.Types.ObjectId();

            const wrongUrl = url.replace(
                versionId.toString(),
                otherVersionId.toString()
            );

            const response = await get(ownerToken, wrongUrl);

            assert.equal(response.status, 404);
        });

        await t.test("GET rejects wrong endpoint scope", async () => {
            const otherEndpointId = new mongoose.Types.ObjectId();

            const wrongUrl = url.replace(
                endpointId.toString(),
                otherEndpointId.toString()
            );

            const response = await get(ownerToken, wrongUrl);

            assert.equal(response.status, 404);
        });

        await t.test("active version blocks POST", async () => {
            await APIVersion.updateOne(
                { _id: versionId, ...scope },
                { $set: { status: "active" } }
            );

            try {
                const before = await getRevision();

                const response = await post(initialMock);

                assert.equal(response.status, 409);
                assert.equal(await getRevision(), before);
            } finally {
                await APIVersion.updateOne(
                    { _id: versionId, ...scope },
                    { $set: { status: "draft" } }
                );
            }
        });

        await t.test("active version blocks PATCH", async () => {
            await APIVersion.updateOne(
                { _id: versionId, ...scope },
                { $set: { status: "active" } }
            );

            try {
                const before = await getRevision();

                const response = await patch(initialMock);

                assert.equal(response.status, 409);
                assert.equal(await getRevision(), before);
            } finally {
                await APIVersion.updateOne(
                    { _id: versionId, ...scope },
                    { $set: { status: "draft" } }
                );
            }
        });

        await t.test("active version blocks DELETE", async () => {
            await APIVersion.updateOne(
                { _id: versionId, ...scope },
                { $set: { status: "active" } }
            );

            try {
                const before = await getRevision();

                const response = await remove();

                assert.equal(response.status, 409);
                assert.equal(await getRevision(), before);
            } finally {
                await APIVersion.updateOne(
                    { _id: versionId, ...scope },
                    { $set: { status: "draft" } }
                );
            }
        });

        await t.test("active version allows GET", async () => {
            await APIVersion.updateOne(
                { _id: versionId, ...scope },
                { $set: { status: "active" } }
            );

            try {
                const response = await get();

                assert.equal(response.status, 200);
                assert.equal(response.body.data.statusCode, 201);
            } finally {
                await APIVersion.updateOne(
                    { _id: versionId, ...scope },
                    { $set: { status: "draft" } }
                );
            }
        });

        await t.test("archived endpoint blocks GET", async () => {
            await APIEndpoint.updateOne(
                { _id: endpointId, ...scope, apiVersionId: versionId },
                { $set: { status: "archived" } }
            );

            try {
                const response = await get();

                assert.equal(response.status, 404);
            } finally {
                await APIEndpoint.updateOne(
                    { _id: endpointId, ...scope, apiVersionId: versionId },
                    { $set: { status: "draft" } }
                );
            }
        });

        await t.test("DELETE removes mock", async () => {
            const before = await getRevision();

            const response = await remove();

            assert.equal(response.status, 200);
            assert.equal(response.body.success, true);
            assert.equal(await getRevision(), before + 1);

            const saved = await APIEndpointMockResponse.findOne(
                mockFilter
            );

            assert.equal(saved, null);
        });

        await t.test("GET after DELETE returns 404", async () => {
            const response = await get();

            assert.equal(response.status, 404);
        });

        await t.test("DELETE missing mock returns 404", async () => {
            const before = await getRevision();

            const response = await remove();

            assert.equal(response.status, 404);
            assert.equal(await getRevision(), before);
        });

        await t.test("PATCH missing mock returns 404", async () => {
            const before = await getRevision();

            const response = await patch(initialMock);

            assert.equal(response.status, 404);
            assert.equal(await getRevision(), before);
        });
    } finally {
        // Delete only fixtures created by this test.
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIEndpointMockResponse.deleteOne(mockFilter);

            await APIEndpoint.deleteOne({
                _id: endpointId,
                ...scope,
                apiVersionId: versionId,
            });

            await APIVersion.deleteOne({
                _id: versionId,
                ...scope,
            });

            await OrganizationMember.deleteOne({
                organizationId,
                userId: developerId,
            });

            await OrganizationMember.deleteOne({
                organizationId,
                userId,
            });

            await Organization.deleteOne({
                _id: organizationId,
                ownerId: userId,
            });
        }

        await mongoose.disconnect();
    }
});
