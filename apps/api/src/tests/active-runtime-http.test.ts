import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";

test("active runtime authenticated HTTP integration", async (t) => {
    // Never connect before validating the target database.
    const uri = process.env.MONGODB_URI;

    if (
        process.env.NODE_ENV !== "test" ||
        !uri ||
        new URL(uri).pathname !== "/api_forge_test"
    ) {
        throw new Error("Test blocked: unsafe MongoDB configuration");
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("Test blocked: JWT_SECRET is missing");
    }

    // Import the application only after validating test configuration.
    const { default: app } = await import("../app.js");

    const { default: Organization } =
        await import("../models/Organization.js");

    const { default: OrganizationMember } =
        await import("../models/OrganizationMember.js");

    const { default: APIVersion } =
        await import("../models/APIVersion.js");

    const { default: APIEndpoint } =
        await import("../models/APIEndpoint.js");

    const { verifyTestDatabase } =
        await import("./helpers/test-database.js");

    const userId = new mongoose.Types.ObjectId();
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

    const token = jwt.sign(
        {
            userId: userId.toString(),
            role: "user",
        },
        secret,
        { expiresIn: "1h" }
    );

    const url =
        `/api/organizations/${organizationId}` +
        `/projects/${projectId}` +
        `/apis/${apiId}` +
        `/runtime/resolve/active`;

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        await Organization.create({
            _id: organizationId,
            name: "Runtime HTTP Test Organization",
            slug: `runtime-http-${organizationId.toString()}`,
            ownerId: userId,
            isActive: true,
        });

        await OrganizationMember.create({
            organizationId,
            userId,
            role: "developer",
        });

        await APIVersion.create({
            _id: versionId,
            ...scope,
            version: 1,
            versionLabel: "v1",
            status: "active",
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

        const response = await request(app)
            .post(url)
            .set("Cookie", `token=${token}`)
            .send({
                method: "GET",
                path: "/users/123",
            });

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);

        // Confirm the response resolves our isolated fixture.
        // The active runtime controller returns endpoint metadata.
        assert.equal(
            response.body.data.endpointId,
            endpointId.toString()
        );

        assert.equal(
            response.body.data.versionId,
            versionId.toString()
        );

        assert.equal(response.body.data.params.id, "123");

        await t.test("rejects authenticated non-member", async () => {
            const nonMemberId = new mongoose.Types.ObjectId();

            const nonMemberToken = jwt.sign(
                {
                    userId: nonMemberId.toString(),
                    role: "user",
                },
                secret,
                { expiresIn: "1h" }
            );

            const response = await request(app)
                .post(url)
                .set("Cookie", `token=${nonMemberToken}`)
                .send({
                    method: "GET",
                    path: "/users/123",
                });

            assert.equal(response.status, 403);
            assert.equal(response.body.success, false);
            assert.equal(
                response.body.message,
                "You are not a member of this organization"
            );
        });

        await t.test("rejects inactive organization", async () => {
            // Disable only our test organization.
            await Organization.updateOne(
                { _id: organizationId, ownerId: userId },
                { $set: { isActive: false } }
            );

            try {
                const response = await request(app)
                    .post(url)
                    .set("Cookie", `token=${token}`)
                    .send({
                        method: "GET",
                        path: "/users/123",
                    });

                assert.equal(response.status, 404);
                assert.equal(response.body.success, false);
                assert.equal(
                    response.body.message,
                    "Organization not found"
                );
            } finally {
                // Restore the fixture for subsequent tests.
                await Organization.updateOne(
                    { _id: organizationId, ownerId: userId },
                    { $set: { isActive: true } }
                );
            }
        });

        await t.test("does not resolve another organization's API", async () => {
            const otherOrganizationId = new mongoose.Types.ObjectId();

            const otherOrganizationUrl =
                `/api/organizations/${otherOrganizationId}` +
                `/projects/${projectId}` +
                `/apis/${apiId}` +
                `/runtime/resolve/active`;

            const response = await request(app)
                .post(otherOrganizationUrl)
                .set("Cookie", `token=${token}`)
                .send({
                    method: "GET",
                    path: "/users/123",
                });

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
            assert.equal(response.body.message, "Organization not found");
        });
        await t.test("does not resolve another API", async () => {
            const otherApiId = new mongoose.Types.ObjectId();

            const otherApiUrl =
                `/api/organizations/${organizationId}` +
                `/projects/${projectId}` +
                `/apis/${otherApiId}` +
                `/runtime/resolve/active`;

            const response = await request(app)
                .post(otherApiUrl)
                .set("Cookie", `token=${token}`)
                .send({
                    method: "GET",
                    path: "/users/123",
                });

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });
        await t.test("rejects unsupported HTTP method", async () => {
            const response = await request(app)
                .post(url)
                .set("Cookie", `token=${token}`)
                .send({
                    method: "OPTIONS",
                    path: "/users/123",
                });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });
        await t.test("rejects malformed endpoint path", async () => {
            const response = await request(app)
                .post(url)
                .set("Cookie", `token=${token}`)
                .send({
                    method: "GET",
                    path: "/users//123",
                });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });
        await t.test("rejects malformed URL encoding", async () => {
            const response = await request(app)
                .post(url)
                .set("Cookie", `token=${token}`)
                .send({
                    method: "GET",
                    path: "/users/%ZZ",
                });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });
        await t.test("returns 404 for nonexistent endpoint", async () => {
            const response = await request(app)
                .post(url)
                .set("Cookie", `token=${token}`)
                .send({
                    method: "GET",
                    path: "/endpoint-does-not-exist",
                });

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });
        await t.test("does not resolve inactive API version", async () => {
            // Change only our test API version.
            await APIVersion.updateOne(
                {
                    _id: versionId,
                    ...scope,
                },
                {
                    $set: { status: "deprecated" },
                }
            );

            try {
                const response = await request(app)
                    .post(url)
                    .set("Cookie", `token=${token}`)
                    .send({
                        method: "GET",
                        path: "/users/123",
                    });

                assert.equal(response.status, 404);
                assert.equal(response.body.success, false);
            } finally {
                // Restore the test version for subsequent tests.
                await APIVersion.updateOne(
                    {
                        _id: versionId,
                        ...scope,
                    },
                    {
                        $set: { status: "active" },
                    }
                );
            }
        });
        await t.test("does not resolve archived endpoint", async () => {
            // Archive only the endpoint created by this test.
            await APIEndpoint.updateOne(
                {
                    _id: endpointId,
                    ...scope,
                    apiVersionId: versionId,
                },
                {
                    $set: { status: "archived" },
                }
            );

            try {
                const response = await request(app)
                    .post(url)
                    .set("Cookie", `token=${token}`)
                    .send({
                        method: "GET",
                        path: "/users/123",
                    });

                assert.equal(response.status, 404);
                assert.equal(response.body.success, false);
            } finally {
                // Restore the fixture for subsequent tests.
                await APIEndpoint.updateOne(
                    {
                        _id: endpointId,
                        ...scope,
                        apiVersionId: versionId,
                    },
                    {
                        $set: { status: "draft" },
                    }
                );
            }
        });
        await t.test("rejects missing HTTP method", async () => {
            const response = await request(app)
                .post(url)
                .set("Cookie", `token=${token}`)
                .send({
                    path: "/users/123",
                });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });
        await t.test("rejects missing endpoint path", async () => {
            const response = await request(app)
                .post(url)
                .set("Cookie", `token=${token}`)
                .send({
                    method: "GET",
                });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });
        await t.test("rejects empty request body", async () => {
            const response = await request(app)
                .post(url)
                .set("Cookie", `token=${token}`)
                .send({});

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });
        await t.test("does not resolve endpoint with wrong HTTP method", async () => {
            const response = await request(app)
                .post(url)
                .set("Cookie", `token=${token}`)
                .send({
                    method: "POST",
                    path: "/users/123",
                });

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });
        await t.test("does not resolve endpoint from another project", async () => {
            const otherProjectId = new mongoose.Types.ObjectId();

            const otherProjectUrl =
                `/api/organizations/${organizationId}` +
                `/projects/${otherProjectId}` +
                `/apis/${apiId}/runtime/resolve/active`;

            const response = await request(app)
                .post(otherProjectUrl)
                .set("Cookie", `token=${token}`)
                .send({
                    method: "GET",
                    path: "/users/123",
                });

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });
        await t.test("rejects malformed resource IDs", async () => {
            const invalidId = "invalid-id";

            const invalidUrls = [
                `/api/organizations/${invalidId}/projects/${projectId}/apis/${apiId}/runtime/resolve/active`,
                `/api/organizations/${organizationId}/projects/${invalidId}/apis/${apiId}/runtime/resolve/active`,
                `/api/organizations/${organizationId}/projects/${projectId}/apis/${invalidId}/runtime/resolve/active`,
            ];

            for (const invalidUrl of invalidUrls) {
                const response = await request(app)
                    .post(invalidUrl)
                    .set("Cookie", `token=${token}`)
                    .send({
                        method: "GET",
                        path: "/users/123",
                    });

                assert.equal(response.status, 400);
                assert.equal(response.body.success, false);
            }
        });
    } finally {
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
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