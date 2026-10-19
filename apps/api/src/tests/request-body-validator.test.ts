import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    validateRequestBody,
} from "../runtime/validators/request-body.validator.js";

const fields = [
    { name: "name", type: "string", required: true },
    { name: "age", type: "number", required: true },
    { name: "active", type: "boolean", required: false },
    { name: "birthday", type: "date", required: false },
    { name: "ownerId", type: "objectId", required: false },
] as const;

const validate = (
    body: unknown,
    required = true
) =>
    validateRequestBody({
        body,
        required,
        fields: [...fields],
    });

describe("P3 request body validator", () => {
    it("accepts a valid JSON body", () => {
        assert.deepEqual(
            validate({
                name: "John",
                age: 25,
                active: true,
                birthday: "2026-10-15",
                ownerId: "507f1f77bcf86cd799439011",
            }),
            []
        );
    });

    it("rejects a missing required body", () => {
        const errors = validate(undefined);

        assert.equal(errors.length, 1);
        assert.equal(errors[0].field, "body");
    });

    it("allows a missing optional body", () => {
        assert.deepEqual(validate(undefined, false), []);
    });

    it("rejects a non-object body", () => {
        assert.equal(validate("hello").length, 1);
        assert.equal(validate([]).length, 1);
    });

    it("rejects missing required fields", () => {
        const errors = validate({ active: true });

        assert.equal(errors.length, 2);
        assert.deepEqual(
            errors.map((error) => error.field),
            ["name", "age"]
        );
    });

    it("rejects incorrect string types", () => {
        const errors = validate({
            name: 123,
            age: 25,
        });

        assert.equal(errors.length, 1);
        assert.equal(errors[0].field, "name");
    });

    it("rejects incorrect number types", () => {
        const errors = validate({
            name: "John",
            age: "25",
        });

        assert.equal(errors.length, 1);
        assert.equal(errors[0].field, "age");
    });

    it("rejects incorrect boolean types", () => {
        const errors = validate({
            name: "John",
            age: 25,
            active: "true",
        });

        assert.equal(errors.length, 1);
        assert.equal(errors[0].field, "active");
    });

    it("rejects invalid dates", () => {
        const errors = validate({
            name: "John",
            age: 25,
            birthday: "not-a-date",
        });

        assert.equal(errors.length, 1);
        assert.equal(errors[0].field, "birthday");
    });

    it("rejects invalid ObjectIds", () => {
        const errors = validate({
            name: "John",
            age: 25,
            ownerId: "invalid-id",
        });

        assert.equal(errors.length, 1);
        assert.equal(errors[0].field, "ownerId");
    });

    it("allows missing optional fields", () => {
        assert.deepEqual(
            validate({
                name: "John",
                age: 25,
            }),
            []
        );
    });

    it("returns multiple field errors", () => {
        const errors = validate({
            name: 123,
            age: "invalid",
            active: "yes",
        });

        assert.equal(errors.length, 3);
    });

    it("permits extra fields for the current MVP", () => {
        assert.deepEqual(
            validate({
                name: "John",
                age: 25,
                extra: "allowed",
            }),
            []
        );
    });
});