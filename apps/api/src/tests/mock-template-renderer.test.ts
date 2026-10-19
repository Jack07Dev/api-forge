import assert from "node:assert/strict";
import { test } from "node:test";
import { renderMockTemplate } from "../runtime/utils/mock-template.renderer.js";

const context = { params: { id: "123", orderId: "A-2" }, query: { name: "John", city: "Mumbai" } };

test("P2 mock template renderer", async (t) => {
    await t.test("renders path parameters", () => {
        assert.deepEqual(renderMockTemplate({ id: "{{params.id}}" }, context), { id: "123" });
    });
    await t.test("renders query parameters", () => {
        assert.deepEqual(renderMockTemplate({ name: "{{query.name}}" }, context), { name: "John" });
    });
    await t.test("renders multiple embedded placeholders", () => {
        assert.deepEqual(renderMockTemplate({ text: "{{query.name}}-{{params.id}}-{{params.orderId}}" }, context), { text: "John-123-A-2" });
    });
    await t.test("renders nested objects and arrays", () => {
        assert.deepEqual(renderMockTemplate({ data: [{ id: "{{params.id}}", city: "{{query.city}}" }] }, context), { data: [{ id: "123", city: "Mumbai" }] });
    });
    await t.test("preserves primitive values and static text", () => {
        const input = { count: 5, active: true, missing: null, label: "static" };
        assert.deepEqual(renderMockTemplate(input, context), input);
    });
    await t.test("preserves missing and unsupported placeholders", () => {
        assert.deepEqual(renderMockTemplate({ a: "{{params.missing}}", b: "{{headers.auth}}" }, context), { a: "{{params.missing}}", b: "{{headers.auth}}" });
    });
    await t.test("does not use inherited object properties", () => {
        assert.deepEqual(renderMockTemplate({ a: "{{params.constructor}}", b: "{{query.toString}}" }, context), { a: "{{params.constructor}}", b: "{{query.toString}}" });
    });
    await t.test("does not mutate the stored template", () => {
        const input = { id: "{{params.id}}" };
        assert.deepEqual(renderMockTemplate(input, context), { id: "123" });
        assert.deepEqual(input, { id: "{{params.id}}" });
    });
    await t.test("supports JSON arrays at the root", () => {
        assert.deepEqual(renderMockTemplate(["{{params.id}}", { name: "{{query.name}}" }], context), ["123", { name: "John" }]);
    });
    await t.test("rejects deeply nested templates", () => {
        let nested: unknown = "value";
        for (let i = 0; i < 51; i++) nested = [nested];
        assert.throws(() => renderMockTemplate(nested, context), { message: "MOCK_TEMPLATE_TOO_DEEP" });
    });
    await t.test("rejects responses that grow beyond 64 KiB", () => {
        const oversized = { params: { id: "x".repeat(65 * 1024) } };
        assert.throws(() => renderMockTemplate({ id: "{{params.id}}" }, oversized), { message: "RENDERED_MOCK_RESPONSE_TOO_LARGE" });
    });
    await t.test("preserves special object keys without prototype mutation", () => {
        const template = JSON.parse('{"__proto__":{"value":"{{params.id}}"}}');
        const result = renderMockTemplate(template, context);
        assert.equal((result as Record<string, any>)["__proto__"].value, "123");
        assert.equal(({} as Record<string, unknown>)["value"], undefined);
    });
});
