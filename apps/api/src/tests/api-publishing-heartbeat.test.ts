import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import APIVersion from "../models/APIVersion.js";
import { renewPublishingLock } from "../services/api-publishing-heartbeat.service.js";

const originalUpdateOne = APIVersion.updateOne;

afterEach(() => {
    APIVersion.updateOne = originalUpdateOne;
});

const input = {
    organizationId: "507f1f77bcf86cd799439011",
    projectId: "507f1f77bcf86cd799439012",
    apiId: "507f1f77bcf86cd799439013",
    versionId: "507f1f77bcf86cd799439014",
    publishingToken: "test-token",
    definitionRevision: 3,
};

test("heartbeat succeeds when lock ownership is valid", async () => {
    let capturedFilter: Record<string, unknown> | undefined;

    APIVersion.updateOne = (async (filter: unknown) => {
        capturedFilter = filter as Record<string, unknown>;
        return { matchedCount: 1, modifiedCount: 1 };
    }) as unknown as typeof APIVersion.updateOne;

    const renewed = await renewPublishingLock(input);

    assert.equal(renewed, true);
    assert.equal(capturedFilter?.status, "publishing");
    assert.equal(capturedFilter?.publishingToken, "test-token");
    assert.equal(capturedFilter?.definitionRevision, 3);
    assert.equal(capturedFilter?.organizationId, input.organizationId);
    assert.equal(capturedFilter?.projectId, input.projectId);
    assert.equal(capturedFilter?.apiId, input.apiId);
    assert.equal(capturedFilter?._id, input.versionId);
});

test("heartbeat fails when lock ownership is lost", async () => {
    APIVersion.updateOne = (async () => {
        return { matchedCount: 0, modifiedCount: 0 };
    }) as unknown as typeof APIVersion.updateOne;

    const renewed = await renewPublishingLock(input);

    assert.equal(renewed, false);
});

test("heartbeat propagates database failures", async () => {
    APIVersion.updateOne = (async () => {
        throw new Error("Simulated MongoDB failure");
    }) as unknown as typeof APIVersion.updateOne;

    await assert.rejects(
        renewPublishingLock(input),
        /Simulated MongoDB failure/
    );
});

test("heartbeat uses expiration protection", async () => {
    let capturedFilter: Record<string, any> | undefined;

    APIVersion.updateOne = (async (filter: unknown) => {
        capturedFilter = filter as Record<string, any>;
        return { matchedCount: 1, modifiedCount: 1 };
    }) as unknown as typeof APIVersion.updateOne;

    const before = Date.now();

    await renewPublishingLock(input);

    const after = Date.now();
    const cutoff = capturedFilter?.publishingStartedAt?.$gte;

    assert.ok(cutoff instanceof Date);

    const timeout = 10 * 60 * 1000;

    assert.ok(cutoff.getTime() >= before - timeout);
    assert.ok(cutoff.getTime() <= after - timeout);
});