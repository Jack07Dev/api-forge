import assert from "node:assert/strict";
import { test } from "node:test";

import { validateMockResponse } from "../runtime/validators/mock-response.validator.js";

test("mock response validator", async (t) => {
    await t.test("accepts valid JSON response", () => {
        const result = validateMockResponse({
            statusCode: 200,
            responseBody: {
                id: "123",
                name: "John",
            },
        });

        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.responseBody, {
            id: "123",
            name: "John",
        });
    });

    await t.test("accepts JSON array", () => {
        const result = validateMockResponse({
            statusCode: 200,
            responseBody: [{ id: 1 }, { id: 2 }],
        });

        assert.deepEqual(result.responseBody, [
            { id: 1 },
            { id: 2 },
        ]);
    });

    await t.test("rejects invalid status code", () => {
        assert.throws(
            () =>
                validateMockResponse({
                    statusCode: 700,
                    responseBody: {},
                }),
            /INVALID_MOCK_STATUS_CODE/
        );
    });

    await t.test("rejects missing response body", () => {
        assert.throws(
            () =>
                validateMockResponse({
                    statusCode: 200,
                    responseBody: undefined,
                }),
            /INVALID_MOCK_RESPONSE_BODY/
        );
    });

    await t.test("rejects body with HTTP 204", () => {
        assert.throws(
            () =>
                validateMockResponse({
                    statusCode: 204,
                    responseBody: {},
                }),
            /MOCK_STATUS_DOES_NOT_ALLOW_BODY/
        );
    });

    await t.test("rejects oversized response", () => {
        assert.throws(
            () =>
                validateMockResponse({
                    statusCode: 200,
                    responseBody: {
                        data: "x".repeat(70 * 1024),
                    },
                }),
            /MOCK_RESPONSE_TOO_LARGE/
        );
    });

    await t.test("rejects circular JSON", () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        assert.throws(
            () =>
                validateMockResponse({
                    statusCode: 200,
                    responseBody: circular,
                }),
            /INVALID_MOCK_RESPONSE_BODY/
        );
    });
});