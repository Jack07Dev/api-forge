
import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";

import APIEndpointMockResponse from "../models/APIEndpointMockResponse.js";
import { resolveMockResponse } from "../runtime/resolvers/mock-response.resolver.js";

const createScope = () => ({
    organizationId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    apiId: new mongoose.Types.ObjectId(),
    apiVersionId: new mongoose.Types.ObjectId(),
    endpointId: new mongoose.Types.ObjectId(),
});

const toResolverInput = (scope: ReturnType<typeof createScope>) => ({
    organizationId: scope.organizationId.toString(),
    projectId: scope.projectId.toString(),
    apiId: scope.apiId.toString(),
    apiVersionId: scope.apiVersionId.toString(),
    endpointId: scope.endpointId.toString(),
});

test("mock response resolver integration", async (t) => {
    const uri = process.env.MONGODB_URI;

    // Block connections to any database other than api_forge_test.
    if (
        process.env.NODE_ENV !== "test" ||
        !uri ||
        new URL(uri).pathname !== "/api_forge_test"
    ) {
        throw new Error("Test blocked: unsafe MongoDB configuration");
    }

    const { verifyTestDatabase } = await import(
        "./helpers/test-database.js"
    );

    try {
        await mongoose.connect(uri, {
            dbName: "api_forge_test",
            autoIndex: false,
        });

        verifyTestDatabase();

        // 1. Database isolation
        await t.test("test database is isolated", () => {
            assert.equal(
                mongoose.connection.db?.databaseName,
                "api_forge_test"
            );
        });

        // 2. Retrieve a configured mock response
        await t.test("retrieves configured mock response", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 200,
                    responseBody: {
                        id: "123",
                        name: "John",
                    },
                });

                const result = await resolveMockResponse(
                    toResolverInput(scope)
                );

                assert.ok(result);
                assert.equal(result.statusCode, 200);
                assert.deepEqual(result.responseBody, {
                    id: "123",
                    name: "John",
                });
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 3. Organization isolation
        await t.test("enforces organization isolation", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 200,
                    responseBody: { success: true },
                });

                const result = await resolveMockResponse({
                    ...toResolverInput(scope),
                    organizationId: new mongoose.Types.ObjectId().toString(),
                });

                assert.equal(result, null);
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 4. Project isolation
        await t.test("enforces project isolation", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 200,
                    responseBody: { success: true },
                });

                const result = await resolveMockResponse({
                    ...toResolverInput(scope),
                    projectId: new mongoose.Types.ObjectId().toString(),
                });

                assert.equal(result, null);
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 5. API isolation
        await t.test("enforces API isolation", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 200,
                    responseBody: { success: true },
                });

                const result = await resolveMockResponse({
                    ...toResolverInput(scope),
                    apiId: new mongoose.Types.ObjectId().toString(),
                });

                assert.equal(result, null);
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 6. API version isolation
        await t.test("enforces API version isolation", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 200,
                    responseBody: { success: true },
                });

                const result = await resolveMockResponse({
                    ...toResolverInput(scope),
                    apiVersionId: new mongoose.Types.ObjectId().toString(),
                });

                assert.equal(result, null);
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 7. Endpoint isolation
        await t.test("enforces endpoint isolation", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 200,
                    responseBody: { success: true },
                });

                const result = await resolveMockResponse({
                    ...toResolverInput(scope),
                    endpointId: new mongoose.Types.ObjectId().toString(),
                });

                assert.equal(result, null);
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 8. Missing mock response
        await t.test("returns null when mock response is missing", async () => {
            const scope = createScope();

            const result = await resolveMockResponse(
                toResolverInput(scope)
            );

            assert.equal(result, null);
        });

        // 9. Invalid organization ID
        await t.test("rejects invalid organization ID", async () => {
            const scope = createScope();

            await assert.rejects(
                () =>
                    resolveMockResponse({
                        ...toResolverInput(scope),
                        organizationId: "invalid-id",
                    }),
                { message: "INVALID_MOCK_RESPONSE_IDENTIFIERS" }
            );
        });

        // 10. Invalid project ID
        await t.test("rejects invalid project ID", async () => {
            const scope = createScope();

            await assert.rejects(
                () =>
                    resolveMockResponse({
                        ...toResolverInput(scope),
                        projectId: "invalid-id",
                    }),
                { message: "INVALID_MOCK_RESPONSE_IDENTIFIERS" }
            );
        });

        // 11. Invalid API ID
        await t.test("rejects invalid API ID", async () => {
            const scope = createScope();

            await assert.rejects(
                () =>
                    resolveMockResponse({
                        ...toResolverInput(scope),
                        apiId: "invalid-id",
                    }),
                { message: "INVALID_MOCK_RESPONSE_IDENTIFIERS" }
            );
        });

        // 12. Invalid API version ID
        await t.test("rejects invalid API version ID", async () => {
            const scope = createScope();

            await assert.rejects(
                () =>
                    resolveMockResponse({
                        ...toResolverInput(scope),
                        apiVersionId: "invalid-id",
                    }),
                { message: "INVALID_MOCK_RESPONSE_IDENTIFIERS" }
            );
        });

        // 13. Invalid endpoint ID
        await t.test("rejects invalid endpoint ID", async () => {
            const scope = createScope();

            await assert.rejects(
                () =>
                    resolveMockResponse({
                        ...toResolverInput(scope),
                        endpointId: "invalid-id",
                    }),
                { message: "INVALID_MOCK_RESPONSE_IDENTIFIERS" }
            );
        });

        // 14. Array response body
        await t.test("supports JSON array response bodies", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 200,
                    responseBody: [
                        { id: 1, name: "Alice" },
                        { id: 2, name: "Bob" },
                    ],
                });

                const result = await resolveMockResponse(
                    toResolverInput(scope)
                );

                assert.ok(result);
                assert.equal(result.statusCode, 200);
                assert.deepEqual(result.responseBody, [
                    { id: 1, name: "Alice" },
                    { id: 2, name: "Bob" },
                ]);
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 15. Custom success status code
        await t.test("supports status code 201", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 201,
                    responseBody: {
                        message: "Created successfully",
                    },
                });

                const result = await resolveMockResponse(
                    toResolverInput(scope)
                );

                assert.ok(result);
                assert.equal(result.statusCode, 201);
                assert.deepEqual(result.responseBody, {
                    message: "Created successfully",
                });
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 16. Error status code
        await t.test("supports status code 404", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 404,
                    responseBody: {
                        error: "Resource not found",
                    },
                });

                const result = await resolveMockResponse(
                    toResolverInput(scope)
                );

                assert.ok(result);
                assert.equal(result.statusCode, 404);
                assert.deepEqual(result.responseBody, {
                    error: "Resource not found",
                });
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 17. Invalid persisted response body
        await t.test("rejects invalid stored response body", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 200,
                    responseBody: "invalid-body",
                });

                await assert.rejects(
                    () => resolveMockResponse(toResolverInput(scope)),
                    { message: "INVALID_MOCK_RESPONSE_BODY" }
                );
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 18. Bodyless HTTP status
        await t.test("rejects stored status code 204 with body", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 204,
                    responseBody: { message: "Not allowed" },
                });

                await assert.rejects(
                    () => resolveMockResponse(toResolverInput(scope)),
                    { message: "MOCK_STATUS_DOES_NOT_ALLOW_BODY" }
                );
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

        // 19. Oversized response body
        await t.test("rejects oversized stored response body", async () => {
            const scope = createScope();

            try {
                await APIEndpointMockResponse.create({
                    ...scope,
                    statusCode: 200,
                    responseBody: {
                        data: "x".repeat(70 * 1024),
                    },
                });

                await assert.rejects(
                    () => resolveMockResponse(toResolverInput(scope)),
                    { message: "MOCK_RESPONSE_TOO_LARGE" }
                );
            } finally {
                await APIEndpointMockResponse.deleteOne(scope);
            }
        });

    } finally {
        await mongoose.disconnect();
    }
});
