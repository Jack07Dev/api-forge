import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import request from "supertest";

const { default: APIEndpointParameter } =
    await import("../models/APIEndpointParameter.js");

const { default: APIModel } =
    await import("../models/APIModel.js");

const { default: APIEndpointRequestBody } =
    await import("../models/APIEndpointRequestBody.js");



test("P1 mock execution HTTP integration", async (t) => {
    const uri = process.env.MONGODB_URI;
    const secret = process.env.JWT_SECRET;

    // Block unsafe environments before importing app or connecting.
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

    const mockBody = {
        id: "123",
        name: "John",
        email: "john@example.com",
    };

    const makeToken = (id: mongoose.Types.ObjectId) =>
        jwt.sign(
            { userId: id.toString(), role: "user" },
            secret,
            { expiresIn: "1h" }
        );

    const token = makeToken(userId);

    const url =
        `/api/organizations/${organizationId}` +
        `/projects/${projectId}` +
        `/apis/${apiId}/runtime/execute`;

    const send = (
        body: Record<string, unknown>,
        authToken: string = token
    ) =>
        request(app)
            .post(url)
            .set("Cookie", `token=${authToken}`)
            .send(body);

    const validRequest = {
        method: "GET",
        path: "/users/123",
    };

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        // Create isolated fixtures.
        await Organization.create({
            _id: organizationId,
            name: "Mock Execution HTTP Test Organization",
            slug: `mock-http-${organizationId}`,
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

        await APIEndpointMockResponse.create({
            ...scope,
            apiVersionId: versionId,
            endpointId,
            statusCode: 200,
            responseBody: mockBody,
        });

        // 1. Successful mock execution.
        await t.test("returns configured mock response", async () => {
            const response = await send(validRequest);

            assert.equal(response.status, 200);
            assert.deepEqual(response.body, mockBody);
        });

        // 2. Custom HTTP status code.
        await t.test("returns configured HTTP 201", async () => {
            await APIEndpointMockResponse.updateOne(
                { ...scope, apiVersionId: versionId, endpointId },
                { $set: { statusCode: 201 } }
            );

            try {
                const response = await send(validRequest);

                assert.equal(response.status, 201);
                assert.deepEqual(response.body, mockBody);
            } finally {
                await APIEndpointMockResponse.updateOne(
                    { ...scope, apiVersionId: versionId, endpointId },
                    { $set: { statusCode: 200 } }
                );
            }
        });

        // 3. Missing mock response.
        await t.test("returns 404 when mock is missing", async () => {
            const mockFilter = {
                ...scope,
                apiVersionId: versionId,
                endpointId,
            };

            await APIEndpointMockResponse.deleteOne(mockFilter);

            try {
                const response = await send(validRequest);

                assert.equal(response.status, 404);
                assert.equal(response.body.success, false);
            } finally {
                await APIEndpointMockResponse.create({
                    ...mockFilter,
                    statusCode: 200,
                    responseBody: mockBody,
                });
            }
        });

        // 4. Unauthenticated request.
        await t.test("rejects missing authentication", async () => {
            const response = await request(app)
                .post(url)
                .send(validRequest);

            assert.equal(response.status, 401);
            assert.equal(response.body.success, false);
        });

        // 5. Invalid JWT.
        await t.test("rejects invalid JWT", async () => {
            const response = await send(
                validRequest,
                "invalid.jwt.token"
            );

            assert.equal(response.status, 401);
            assert.equal(response.body.success, false);
        });

        // 6. Authenticated non-member.
        await t.test("rejects non-member", async () => {
            const outsiderId = new mongoose.Types.ObjectId();
            const response = await send(
                validRequest,
                makeToken(outsiderId)
            );

            assert.equal(response.status, 403);
            assert.equal(response.body.success, false);
        });

        // 7. Inactive organization.
        await t.test("rejects inactive organization", async () => {
            await Organization.updateOne(
                { _id: organizationId, ownerId: userId },
                { $set: { isActive: false } }
            );

            try {
                const response = await send(validRequest);

                assert.equal(response.status, 404);
                assert.equal(response.body.success, false);
            } finally {
                await Organization.updateOne(
                    { _id: organizationId, ownerId: userId },
                    { $set: { isActive: true } }
                );
            }
        });

        // 8. Inactive API version.
        await t.test("rejects inactive API version", async () => {
            await APIVersion.updateOne(
                { _id: versionId, ...scope },
                { $set: { status: "deprecated" } }
            );

            try {
                const response = await send(validRequest);

                assert.equal(response.status, 404);
                assert.equal(response.body.success, false);
            } finally {
                await APIVersion.updateOne(
                    { _id: versionId, ...scope },
                    { $set: { status: "active" } }
                );
            }
        });

        // 9. Archived endpoint.
        await t.test("rejects archived endpoint", async () => {
            await APIEndpoint.updateOne(
                { _id: endpointId, ...scope, apiVersionId: versionId },
                { $set: { status: "archived" } }
            );

            try {
                const response = await send(validRequest);

                assert.equal(response.status, 404);
                assert.equal(response.body.success, false);
            } finally {
                await APIEndpoint.updateOne(
                    { _id: endpointId, ...scope, apiVersionId: versionId },
                    { $set: { status: "draft" } }
                );
            }
        });

        // 10. Wrong endpoint method.
        await t.test("rejects wrong endpoint method", async () => {
            const response = await send({
                method: "POST",
                path: "/users/123",
            });

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });

        // 11. Nonexistent endpoint.
        await t.test("rejects nonexistent endpoint", async () => {
            const response = await send({
                method: "GET",
                path: "/does-not-exist",
            });

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });

        // 12. Missing method.
        await t.test("rejects missing method", async () => {
            const response = await send({
                path: "/users/123",
            });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });

        // 13. Missing path.
        await t.test("rejects missing path", async () => {
            const response = await send({
                method: "GET",
            });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });

        // 14. Empty body.
        await t.test("rejects empty body", async () => {
            const response = await send({});

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });

        // 15. Unsupported method.
        await t.test("rejects unsupported method", async () => {
            const response = await send({
                method: "OPTIONS",
                path: "/users/123",
            });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });

        // 16. Malformed path.
        await t.test("rejects malformed path", async () => {
            const response = await send({
                method: "GET",
                path: "/users//123",
            });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });

        // 17. Invalid URL encoding.
        await t.test("rejects invalid URL encoding", async () => {
            const response = await send({
                method: "GET",
                path: "/users/%ZZ",
            });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
        });

        // 18. Wrong project scope.
        await t.test("rejects another project", async () => {
            const otherProjectId = new mongoose.Types.ObjectId();

            const otherUrl =
                `/api/organizations/${organizationId}` +
                `/projects/${otherProjectId}` +
                `/apis/${apiId}/runtime/execute`;

            const response = await request(app)
                .post(otherUrl)
                .set("Cookie", `token=${token}`)
                .send(validRequest);

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });

        // 19. Wrong API scope.
        await t.test("rejects another API", async () => {
            const otherApiId = new mongoose.Types.ObjectId();

            const otherUrl =
                `/api/organizations/${organizationId}` +
                `/projects/${projectId}` +
                `/apis/${otherApiId}/runtime/execute`;

            const response = await request(app)
                .post(otherUrl)
                .set("Cookie", `token=${token}`)
                .send(validRequest);

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });

        // 20. Wrong organization scope.
        await t.test("rejects another organization", async () => {
            const otherOrganizationId = new mongoose.Types.ObjectId();

            const otherUrl =
                `/api/organizations/${otherOrganizationId}` +
                `/projects/${projectId}` +
                `/apis/${apiId}/runtime/execute`;

            const response = await request(app)
                .post(otherUrl)
                .set("Cookie", `token=${token}`)
                .send(validRequest);

            assert.equal(response.status, 404);
            assert.equal(response.body.success, false);
        });

        // 21. Invalid resource IDs.
        await t.test("rejects invalid resource IDs", async () => {
            const invalidUrls = [
                `/api/organizations/invalid-id/projects/${projectId}/apis/${apiId}/runtime/execute`,
                `/api/organizations/${organizationId}/projects/invalid-id/apis/${apiId}/runtime/execute`,
                `/api/organizations/${organizationId}/projects/${projectId}/apis/invalid-id/runtime/execute`,
            ];

            for (const invalidUrl of invalidUrls) {
                const response = await request(app)
                    .post(invalidUrl)
                    .set("Cookie", `token=${token}`)
                    .send(validRequest);

                assert.equal(response.status, 400);
                assert.equal(response.body.success, false);
            }
        });

        // 22. Array mock response.
        await t.test("returns JSON array mock response", async () => {
            const arrayBody = [
                { id: "123", name: "John" },
                { id: "456", name: "Jane" },
            ];

            const mockFilter = {
                ...scope,
                apiVersionId: versionId,
                endpointId,
            };

            await APIEndpointMockResponse.updateOne(
                mockFilter,
                { $set: { responseBody: arrayBody } }
            );

            try {
                const response = await send(validRequest);

                assert.equal(response.status, 200);
                assert.deepEqual(response.body, arrayBody);
            } finally {
                await APIEndpointMockResponse.updateOne(
                    mockFilter,
                    { $set: { responseBody: mockBody } }
                );
            }
        });

        // P2: Dynamic path and query interpolation through the HTTP runtime.
        await t.test("P2 renders dynamic path and query placeholders", async () => {
            const filter = { ...scope, apiVersionId: versionId, endpointId };
            const dynamicBody = {
                id: "{{params.id}}",
                name: "{{query.name}}",
                message: "Hello {{query.name}}, user {{params.id}}",
                nested: [{ id: "{{params.id}}", active: true }],
                missing: "{{query.unknown}}",
            };
            await APIEndpointMockResponse.updateOne(filter, {
                $set: { responseBody: dynamicBody },
            });
            try {
                const first = await send({ ...validRequest, query: { name: "John" } });
                assert.equal(first.status, 200);
                assert.deepEqual(first.body, {
                    id: "123",
                    name: "John",
                    message: "Hello John, user 123",
                    nested: [{ id: "123", active: true }],
                    missing: "{{query.unknown}}",
                });
                const second = await send({
                    method: "GET",
                    path: "/users/456",
                    query: { name: "Jane" },
                });
                assert.equal(second.status, 200);
                assert.equal(second.body.id, "456");
                assert.equal(second.body.name, "Jane");
                const stored = await APIEndpointMockResponse.findOne(filter).lean();
                assert.deepEqual(stored?.responseBody, dynamicBody);
            } finally {
                await APIEndpointMockResponse.updateOne(filter, {
                    $set: { responseBody: mockBody },
                });
            }
        });

        await t.test("P3 rejects invalid runtime headers", async () => {
            const invalidHeaders = [
                null,
                [],
                { "x-api-key": 123 },
                { "x-api-key": ["one", "two"] },
                { "bad header": "value" },
                { "x-api-key": "hello\r\ninjected" },
            ];

            for (const headers of invalidHeaders) {
                const response = await send({
                    ...validRequest,
                    headers,
                });

                assert.equal(response.status, 400);
                assert.equal(
                    response.body.message,
                    "INVALID_RUNTIME_HEADERS"
                );
            }
        });

        await t.test("P3 accepts valid runtime headers without configured rules", async () => {
            const response = await send({
                ...validRequest,
                headers: {
                    "X-API-Key": "example-key",
                    "X-Request-ID": "request-123",
                },
            });

            assert.equal(response.status, 200);
            assert.deepEqual(response.body, mockBody);
        });

        await t.test("P2 rejects invalid query input", async () => {
            for (const query of [null, [], { name: 123 }, { name: ["John"] }, { "bad-key": "value" }]) {
                const response = await send({ ...validRequest, query });
                assert.equal(response.status, 400);
                assert.equal(response.body.message, "INVALID_RUNTIME_QUERY");
            }
        });

        await t.test("P2 blocks oversized rendered HTTP responses", async () => {
            const filter = { ...scope, apiVersionId: versionId, endpointId };
            await APIEndpointMockResponse.updateOne(filter, {
                $set: { responseBody: { value: "{{query.name}}" } },
            });
            try {
                // Query values are individually capped at 4096 chars; 17 placeholders
                // make the rendered JSON exceed the 64 KiB response limit.
                const repeated = Array.from({ length: 17 }, () => "{{query.name}}").join("");
                await APIEndpointMockResponse.updateOne(filter, {
                    $set: { responseBody: { value: repeated } },
                });
                const response = await send({
                    ...validRequest,
                    query: { name: "x".repeat(4096) },
                });
                assert.equal(response.status, 500);
                assert.equal(response.body.success, false);
            } finally {
                await APIEndpointMockResponse.updateOne(filter, {
                    $set: { responseBody: mockBody },
                });
            }
        });

        await t.test("P3 validates configured required query parameters", async () => {
            const parameterScope = {
                ...scope,
                apiVersionId: versionId,
                endpointId,
            };

            try {
                await APIEndpointParameter.create({
                    ...parameterScope,
                    name: "limit",
                    location: "query",
                    dataType: "number",
                    required: true,
                    createdBy: userId,
                });

                // Missing required parameter.
                const missing = await send(validRequest);

                assert.equal(missing.status, 400);
                assert.equal(missing.body.message, "REQUEST_VALIDATION_FAILED");
                assert.ok(
                    missing.body.errors.some(
                        (error: { location: string; field: string }) =>
                            error.location === "query" && error.field === "limit"
                    )
                );

                // Invalid number.
                const invalid = await send({
                    ...validRequest,
                    query: { limit: "abc" },
                });

                assert.equal(invalid.status, 400);
                assert.equal(invalid.body.message, "REQUEST_VALIDATION_FAILED");

                // Valid number.
                const valid = await send({
                    ...validRequest,
                    query: { limit: "10" },
                });

                assert.equal(valid.status, 200);
                assert.deepEqual(valid.body, mockBody);
            } finally {
                await APIEndpointParameter.deleteMany(parameterScope);
            }
        });
        await t.test("P3 validates configured required header parameters", async () => {
            const parameterScope = {
                ...scope,
                apiVersionId: versionId,
                endpointId,
            };

            try {
                await APIEndpointParameter.create({
                    ...parameterScope,
                    name: "x-api-key",
                    location: "header",
                    dataType: "string",
                    required: true,
                    createdBy: userId,
                });

                // 1. Missing required header.
                const missing = await send(validRequest);

                assert.equal(missing.status, 400);
                assert.equal(missing.body.message, "REQUEST_VALIDATION_FAILED");

                assert.ok(
                    missing.body.errors.some(
                        (error: { location: string; field: string }) =>
                            error.location === "header" &&
                            error.field === "x-api-key"
                    )
                );

                // 2. Valid header with mixed-case name.
                const valid = await send({
                    ...validRequest,
                    headers: {
                        "X-API-Key": "secret-123",
                    },
                });

                assert.equal(valid.status, 200);
                assert.deepEqual(valid.body, mockBody);
            } finally {
                await APIEndpointParameter.deleteMany(parameterScope);
            }
        });
        await t.test("P3 validates configured path parameters", async () => {
            const parameterScope = {
                ...scope,
                apiVersionId: versionId,
                endpointId,
            };

            try {
                await APIEndpointParameter.create({
                    ...parameterScope,
                    name: "id",
                    location: "path",
                    dataType: "objectId",
                    required: true,
                    createdBy: userId,
                });

                // Invalid MongoDB ObjectId.
                const invalid = await send({
                    method: "GET",
                    path: "/users/123",
                });

                assert.equal(invalid.status, 400);
                assert.equal(
                    invalid.body.message,
                    "REQUEST_VALIDATION_FAILED"
                );

                assert.ok(
                    invalid.body.errors.some(
                        (error: { location: string; field: string }) =>
                            error.location === "path" && error.field === "id"
                    )
                );

                // Valid MongoDB ObjectId.
                const validId = new mongoose.Types.ObjectId().toString();

                const valid = await send({
                    method: "GET",
                    path: `/users/${validId}`,
                });

                assert.equal(valid.status, 200);
                assert.deepEqual(valid.body, mockBody);
            } finally {
                await APIEndpointParameter.deleteMany(parameterScope);
            }
        });
        await t.test("P3 validates model-backed JSON request bodies", async () => {
            const postEndpointId = new mongoose.Types.ObjectId();
            const modelId = new mongoose.Types.ObjectId();

            const postScope = {
                ...scope,
                apiVersionId: versionId,
                endpointId: postEndpointId,
            };

            try {
                // 1. Create an isolated POST endpoint.
                await APIEndpoint.create({
                    _id: postEndpointId,
                    ...scope,
                    apiVersionId: versionId,
                    name: "Create User P3 Test",
                    method: "POST",
                    path: "/p3-test-users",
                    status: "draft",
                    createdBy: userId,
                });

                // 2. Create its configured mock response.
                await APIEndpointMockResponse.create({
                    ...postScope,
                    statusCode: 201,
                    responseBody: {
                        success: true,
                        message: "User created successfully",
                    },
                });

                // 3. Create a model in the same API version.
                await APIModel.create({
                    _id: modelId,
                    ...scope,
                    versionId,
                    name: "P3 Test User",
                    slug: `p3-test-user-${modelId.toString()}`,
                    status: "draft",
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
                            required: true,
                            unique: false,
                        },
                        {
                            name: "active",
                            type: "boolean",
                            required: false,
                            unique: false,
                        },
                    ],
                    createdBy: userId,
                });

                // 4. Attach the model to the POST request body.
                await APIEndpointRequestBody.create({
                    ...postScope,
                    contentType: "application/json",
                    required: true,
                    modelId,
                    createdBy: userId,
                });

                const postRequest = {
                    method: "POST",
                    path: "/p3-test-users",
                };

                // 5. Missing required request body.
                const missingBody = await send(postRequest);

                assert.equal(missingBody.status, 400);
                assert.equal(
                    missingBody.body.message,
                    "REQUEST_VALIDATION_FAILED"
                );

                // 6. Missing required model field.
                const missingName = await send({
                    ...postRequest,
                    body: {
                        age: 25,
                    },
                });

                assert.equal(missingName.status, 400);

                assert.ok(
                    missingName.body.errors.some(
                        (error: { location: string; field: string }) =>
                            error.location === "body" &&
                            error.field === "name"
                    )
                );

                // 7. Invalid model field types.
                const invalidTypes = await send({
                    ...postRequest,
                    body: {
                        name: 123,
                        age: "twenty-five",
                    },
                });

                assert.equal(invalidTypes.status, 400);
                assert.equal(
                    invalidTypes.body.message,
                    "REQUEST_VALIDATION_FAILED"
                );

                // 8. Valid JSON body.
                const valid = await send({
                    ...postRequest,
                    body: {
                        name: "John",
                        age: 25,
                        active: true,
                    },
                });

                assert.equal(valid.status, 201);

                assert.deepEqual(valid.body, {
                    success: true,
                    message: "User created successfully",
                });

            } finally {
                // Delete only this test's records.
                await APIEndpointRequestBody.deleteMany(postScope);

                await APIModel.deleteOne({
                    _id: modelId,
                    ...scope,
                    versionId,
                });

                await APIEndpointMockResponse.deleteMany(postScope);

                await APIEndpoint.deleteOne({
                    _id: postEndpointId,
                    ...scope,
                    apiVersionId: versionId,
                });
            }
        });
        await t.test("P3 applies optional query defaults in rendered mock responses", async () => {
            const parameterScope = {
                ...scope,
                apiVersionId: versionId,
                endpointId,
            };

            try {
                await APIEndpointParameter.create({
                    ...parameterScope,
                    name: "limit",
                    location: "query",
                    dataType: "number",
                    required: false,
                    defaultValue: "10",
                    createdBy: userId,
                });

                // Configure the existing mock to use the query placeholder.
                await APIEndpointMockResponse.updateOne(
                    parameterScope,
                    {
                        $set: {
                            responseBody: {
                                limit: "{{query.limit}}",
                            },
                        },
                    }
                );

                // Missing query value should use the configured default.
                const defaultResponse = await send(validRequest);

                assert.equal(defaultResponse.status, 200);
                assert.deepEqual(defaultResponse.body, {
                    limit: "10",
                });

                // Explicit request value should override the default.
                const suppliedResponse = await send({
                    ...validRequest,
                    query: {
                        limit: "25",
                    },
                });

                assert.equal(suppliedResponse.status, 200);
                assert.deepEqual(suppliedResponse.body, {
                    limit: "25",
                });

            } finally {
                await APIEndpointParameter.deleteMany(parameterScope);

                // Restore the original mock response for other tests.
                await APIEndpointMockResponse.updateOne(
                    parameterScope,
                    {
                        $set: {
                            responseBody: mockBody,
                        },
                    }
                );
            }
        });
        await t.test("P3 rejects duplicate case-insensitive runtime headers", async () => {
            const response = await send({
                ...validRequest,
                headers: {
                    "X-API-Key": "first-key",
                    "x-api-key": "second-key",
                },
            });

            assert.equal(response.status, 400);
            assert.equal(response.body.success, false);
            assert.equal(
                response.body.message,
                "INVALID_RUNTIME_HEADERS"
            );
        });
        // P3.15: Missing referenced request-body model must fail closed.
        await t.test("P3 fails safely when request-body model is missing", async () => {
            const missingModelId = new mongoose.Types.ObjectId();
            const postEndpointId = new mongoose.Types.ObjectId();
            const postScope = {
                ...scope,
                apiVersionId: versionId,
                endpointId: postEndpointId,
            };

            try {
                await APIEndpoint.create({
                    _id: postEndpointId,
                    ...scope,
                    apiVersionId: versionId,
                    name: "Missing Model Safety Test",
                    method: "POST",
                    path: "/p3-missing-model",
                    status: "draft",
                    createdBy: userId,
                });

                await APIEndpointMockResponse.create({
                    ...postScope,
                    statusCode: 201,
                    responseBody: { created: true },
                });

                await APIEndpointRequestBody.create({
                    ...postScope,
                    contentType: "application/json",
                    required: true,
                    modelId: missingModelId,
                    createdBy: userId,
                });

                const response = await send({
                    method: "POST",
                    path: "/p3-missing-model",
                    body: { name: "John" },
                });

                assert.equal(response.status, 500);
                assert.equal(response.body.success, false);
                assert.equal(
                    response.body.message,
                    "Failed to execute mock API endpoint"
                );
                assert.equal(
                    JSON.stringify(response.body).includes(
                        "RUNTIME_REQUEST_MODEL_NOT_FOUND"
                    ),
                    false
                );
            } finally {
                await APIEndpointRequestBody.deleteMany(postScope);
                await APIEndpointMockResponse.deleteMany(postScope);
                await APIEndpoint.deleteOne({
                    _id: postEndpointId,
                    ...scope,
                    apiVersionId: versionId,
                });
            }
        });

        // P3.16: Report multiple parameter errors in one response.
        await t.test("P3 returns multiple parameter validation errors", async () => {
            const parameterScope = {
                ...scope,
                apiVersionId: versionId,
                endpointId,
            };

            try {
                await APIEndpointParameter.create([
                    {
                        ...parameterScope,
                        name: "limit",
                        location: "query",
                        dataType: "number",
                        required: true,
                        createdBy: userId,
                    },
                    {
                        ...parameterScope,
                        name: "x-request-id",
                        location: "header",
                        dataType: "string",
                        required: true,
                        createdBy: userId,
                    },
                ]);

                const response = await send(validRequest);
                assert.equal(response.status, 400);
                assert.equal(response.body.message, "REQUEST_VALIDATION_FAILED");
                assert.ok(Array.isArray(response.body.errors));
                assert.ok(
                    response.body.errors.some(
                        (error: { location: string; field: string }) =>
                            error.location === "query" && error.field === "limit"
                    )
                );
                assert.ok(
                    response.body.errors.some(
                        (error: { location: string; field: string }) =>
                            error.location === "header" && error.field === "x-request-id"
                    )
                );
            } finally {
                await APIEndpointParameter.deleteMany(parameterScope);
            }
        });

        // P3.17: Header defaults must pass validation without client input.
        await t.test("P3 accepts optional header defaults and explicit overrides", async () => {
            const parameterScope = {
                ...scope,
                apiVersionId: versionId,
                endpointId,
            };

            try {
                await APIEndpointParameter.create({
                    ...parameterScope,
                    name: "x-retry-count",
                    location: "header",
                    dataType: "number",
                    required: false,
                    defaultValue: "3",
                    createdBy: userId,
                });

                const missing = await send(validRequest);
                assert.equal(missing.status, 200);
                assert.deepEqual(missing.body, mockBody);

                const supplied = await send({
                    ...validRequest,
                    headers: { "X-Retry-Count": "5" },
                });
                assert.equal(supplied.status, 200);

                const invalid = await send({
                    ...validRequest,
                    headers: { "X-Retry-Count": "not-a-number" },
                });
                assert.equal(invalid.status, 400);
                assert.equal(invalid.body.message, "REQUEST_VALIDATION_FAILED");
            } finally {
                await APIEndpointParameter.deleteMany(parameterScope);
            }
        });

        // P3.18: Invalid configured query defaults must not bypass type checks.
        await t.test("P3 rejects invalid optional query defaults", async () => {
            const parameterScope = {
                ...scope,
                apiVersionId: versionId,
                endpointId,
            };

            try {
                await APIEndpointParameter.create({
                    ...parameterScope,
                    name: "limit",
                    location: "query",
                    dataType: "number",
                    required: false,
                    defaultValue: "not-a-number",
                    createdBy: userId,
                });

                const invalid = await send(validRequest);
                assert.equal(invalid.status, 400);
                assert.equal(invalid.body.message, "REQUEST_VALIDATION_FAILED");
                assert.ok(
                    invalid.body.errors.some(
                        (error: { location: string; field: string }) =>
                            error.location === "query" && error.field === "limit"
                    )
                );

                const supplied = await send({
                    ...validRequest,
                    query: { limit: "20" },
                });
                assert.equal(supplied.status, 200);
            } finally {
                await APIEndpointParameter.deleteMany(parameterScope);
            }
        });

        // P3.19: Runtime query and header size limits.
        await t.test("P3 rejects oversized runtime query and header values", async () => {
            const oversizedQuery = await send({
                ...validRequest,
                query: { name: "x".repeat(4097) },
            });
            assert.equal(oversizedQuery.status, 400);
            assert.equal(oversizedQuery.body.message, "INVALID_RUNTIME_QUERY");

            const oversizedHeader = await send({
                ...validRequest,
                headers: { "x-request-id": "x".repeat(4097) },
            });
            assert.equal(oversizedHeader.status, 400);
            assert.equal(oversizedHeader.body.message, "INVALID_RUNTIME_HEADERS");
        });
    } finally {
        // Delete only records belonging to this test.
        if (
            mongoose.connection.readyState === 1 &&
            mongoose.connection.db?.databaseName === "api_forge_test"
        ) {
            await APIEndpointMockResponse.deleteOne({
                ...scope,
                apiVersionId: versionId,
                endpointId,
            });

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
