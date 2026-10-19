import assert from "node:assert/strict";
import { describe, it, test } from "node:test";

import {
    validateRequestParameters,
    type ParameterRule,
} from "../runtime/validators/request-parameter.validator.js";

const validate = (
    rules: ParameterRule[],
    params: Record<string, string> = {},
    query: Record<string, string> = {},
    headers: Record<string, string | string[] | undefined> = {}
) =>
    validateRequestParameters({
        rules,
        params,
        query,
        headers,
    });

describe("P3 request parameter validator", () => {
    it("accepts valid required path parameter", () => {
        const errors = validate(
            [{ name: "id", location: "path", dataType: "string", required: true }],
            { id: "123" }
        );

        assert.deepEqual(errors, []);
    });

    it("rejects missing required query parameter", () => {
        const errors = validate([
            { name: "page", location: "query", dataType: "number", required: true },
        ]);

        assert.equal(errors.length, 1);
        assert.equal(errors[0].field, "page");
        assert.equal(errors[0].location, "query");
    });

    it("accepts valid numeric query parameter", () => {
        const errors = validate(
            [{ name: "page", location: "query", dataType: "number", required: true }],
            {},
            { page: "25" }
        );

        assert.deepEqual(errors, []);
    });

    it("rejects invalid numeric query parameter", () => {
        const errors = validate(
            [{ name: "page", location: "query", dataType: "number", required: true }],
            {},
            { page: "abc" }
        );

        assert.equal(errors.length, 1);
    });

    it("validates boolean values", () => {
        const rules: ParameterRule[] = [
            { name: "active", location: "query", dataType: "boolean", required: true },
        ];

        assert.deepEqual(validate(rules, {}, { active: "true" }), []);
        assert.deepEqual(validate(rules, {}, { active: "false" }), []);
        assert.equal(validate(rules, {}, { active: "yes" }).length, 1);
    });

    it("validates date values", () => {
        const rules: ParameterRule[] = [
            { name: "start", location: "query", dataType: "date", required: true },
        ];

        assert.deepEqual(validate(rules, {}, { start: "2026-10-15" }), []);
        assert.equal(validate(rules, {}, { start: "invalid-date" }).length, 1);
    });

    it("validates MongoDB ObjectId values", () => {
        const rules: ParameterRule[] = [
            { name: "id", location: "path", dataType: "objectId", required: true },
        ];

        assert.deepEqual(
            validate(rules, { id: "507f1f77bcf86cd799439011" }),
            []
        );

        assert.equal(validate(rules, { id: "invalid-id" }).length, 1);
    });

    it("validates required headers", () => {
        const rules: ParameterRule[] = [
            { name: "x-api-key", location: "header", dataType: "string", required: true },
        ];

        assert.deepEqual(
            validate(rules, {}, {}, { "x-api-key": "secret" }),
            []
        );

        assert.equal(validate(rules).length, 1);
    });

    it("rejects multiple values for a single header", () => {
        const errors = validate(
            [{ name: "x-role", location: "header", dataType: "string", required: true }],
            {},
            {},
            { "x-role": ["admin", "user"] }
        );

        assert.equal(errors.length, 1);
    });

    it("allows missing optional parameters", () => {
        const errors = validate([
            { name: "search", location: "query", dataType: "string", required: false },
        ]);

        assert.deepEqual(errors, []);
    });

    it("returns multiple validation errors", () => {
        const errors = validate([
            { name: "id", location: "path", dataType: "objectId", required: true },
            { name: "page", location: "query", dataType: "number", required: true },
        ]);

        assert.equal(errors.length, 2);
    });

    it("accepts an endpoint without parameter rules", () => {
        assert.deepEqual(validate([]), []);
    });
});

test("applies a configured default for an optional query parameter", () => {
    const query: Record<string, string> = {};

    const errors = validateRequestParameters({
        rules: [
            {
                name: "limit",
                location: "query",
                dataType: "number",
                required: false,
                defaultValue: "10",
            },
        ],
        params: {},
        query,
        headers: {},
    });

    assert.deepEqual(errors, []);
    assert.equal(query.limit, "10");
});