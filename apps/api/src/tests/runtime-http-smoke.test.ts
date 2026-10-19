import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";

test("runtime HTTP smoke tests", async (t) => {
    const uri = process.env.MONGODB_URI;

    if (!uri || new URL(uri).pathname !== "/api_forge_test") {
        throw new Error("Test blocked: incorrect MongoDB database");
    }

    const { default: app } = await import("../app.js");

    await t.test("health endpoint responds", async () => {
        const response = await request(app).get("/api/health");

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
    });

    await t.test("active runtime requires authentication", async () => {
        const response = await request(app)
            .post(
                "/api/organizations/507f1f77bcf86cd799439011/projects/507f191e810c19729de860ea/apis/507f1f77bcf86cd799439012/runtime/resolve/active"
            )
            .send({
                method: "GET",
                path: "/users",
            });

        assert.equal(response.status, 401);
        assert.equal(response.body.success, false);
    });

    await t.test("active runtime rejects invalid JWT", async () => {
        const response = await request(app)
            .post(
                "/api/organizations/507f1f77bcf86cd799439011/projects/507f191e810c19729de860ea/apis/507f1f77bcf86cd799439012/runtime/resolve/active"
            )
            .set("Cookie", "token=invalid.jwt.token")
            .send({
                method: "GET",
                path: "/users",
            });

        assert.equal(response.status, 401);
        assert.equal(response.body.success, false);
        assert.equal(
            response.body.message,
            "Invalid or expired authentication token"
        );
    });
});

