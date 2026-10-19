import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import APIVersion from "../models/APIVersion.js";
import { releasePublishingLock } from "../services/api-publishing.service.js";

const originalFindOneAndUpdate = APIVersion.findOneAndUpdate;

afterEach(() => {
    APIVersion.findOneAndUpdate = originalFindOneAndUpdate;
});

const input = {
    organizationId: "507f1f77bcf86cd799439011",
    projectId: "507f1f77bcf86cd799439012",
    apiId: "507f1f77bcf86cd799439013",
    versionId: "507f1f77bcf86cd799439014",
    publishingToken: "original-owner-token",
};

test("cleanup uses exact publishing token and scope", async () => {
    let capturedFilter: Record<string, unknown> | undefined;
    let capturedUpdate: Record<string, any> | undefined;

    APIVersion.findOneAndUpdate = (async (filter: unknown, update: unknown) => {
        capturedFilter = filter as Record<string, unknown>;
        capturedUpdate = update as Record<string, any>;

        return { status: "draft" };
    }) as typeof APIVersion.findOneAndUpdate;

    await releasePublishingLock(input);

    assert.equal(capturedFilter?._id, input.versionId);
    assert.equal(capturedFilter?.organizationId, input.organizationId);
    assert.equal(capturedFilter?.projectId, input.projectId);
    assert.equal(capturedFilter?.apiId, input.apiId);
    assert.equal(capturedFilter?.status, "publishing");
    assert.equal(capturedFilter?.publishingToken, input.publishingToken);

    assert.equal(capturedUpdate?.$set?.status, "draft");
    assert.ok(
        Object.hasOwn(capturedUpdate?.$unset ?? {}, "publishingToken")
    );
    assert.ok(
        Object.hasOwn(capturedUpdate?.$unset ?? {}, "publishingStartedAt")
    );
});

test("cleanup cannot release a different owner's lock", async () => {
    APIVersion.findOneAndUpdate = (async (filter: any) => {
        if (filter.publishingToken !== "new-owner-token") {
            return null;
        }

        return { status: "draft" };
    }) as typeof APIVersion.findOneAndUpdate;

    await assert.rejects(
        releasePublishingLock(input),
        /Publishing lock not found or token does not match/
    );
});

test("cleanup rejects when lock is already released", async () => {
    APIVersion.findOneAndUpdate = (async () => {
        return null;
    }) as typeof APIVersion.findOneAndUpdate;

    await assert.rejects(
        releasePublishingLock(input),
        /Publishing lock not found or token does not match/
    );
});