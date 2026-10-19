import assert from "node:assert/strict";
import { test } from "node:test";
import dotenv from "dotenv";

test("runtime HTTP test environment is isolated", async () => {
    const result = dotenv.config({
        path: ".env.test",
        override: true,
        quiet: true,
    });

    assert.equal(result.error, undefined, "Unable to load .env.test");

    const uri = process.env.MONGODB_URI;

    assert.ok(uri, "MONGODB_URI is required");
    assert.equal(
        new URL(uri).pathname,
        "/api_forge_test",
        "Tests must target api_forge_test"
    );

    assert.ok(process.env.JWT_SECRET, "JWT_SECRET is required");

    // Import only after loading and verifying the test environment.
    const { env } = await import("../config/env.js");

    assert.equal(env.mongodbUri, uri);
    assert.equal(env.jwtSecret, process.env.JWT_SECRET);
});