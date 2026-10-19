import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    findOneAndUpdate: vi.fn(),
    validateDefinition: vi.fn(),
    generateSpec: vi.fn(),
    validateSpec: vi.fn(),
    renewLock: vi.fn(),
    verifyOwnership: vi.fn(),
    activateVersion: vi.fn(),
}));

vi.mock("../models/APIVersion.js", () => ({
    default: {
        findOneAndUpdate: mocks.findOneAndUpdate,
    },
}));

vi.mock("../services/api-definition-validation.service.js", () => ({
    validateAPIVersionDefinition: mocks.validateDefinition,
}));

vi.mock("../services/openapi-generator.service.js", () => ({
    generateOpenAPISpec: mocks.generateSpec,
}));

vi.mock("../services/openapi-validation.service.js", () => ({
    validateOpenAPISpec: mocks.validateSpec,
}));

vi.mock("../services/api-publishing-heartbeat.service.js", () => ({
    renewPublishingLock: mocks.renewLock,
}));

vi.mock("../services/api-publishing-ownership.service.js", () => ({
    verifyPublishingLockOwnership: mocks.verifyOwnership,
}));

vi.mock("../services/api-version.service.js", () => ({
    activateAPIVersion: mocks.activateVersion,
}));

import { publishValidatedAPIVersion } from
    "../services/api-publishing.service.js";

const input = {
    organizationId: "507f1f77bcf86cd799439011",
    projectId: "507f1f77bcf86cd799439012",
    apiId: "507f1f77bcf86cd799439013",
    versionId: "507f1f77bcf86cd799439014",
};

const token = "isolated-test-token";

const waitForValidation = () => {
    let resolve!: (value: { valid: boolean }) => void;

    const promise = new Promise<{ valid: boolean }>((done) => {
        resolve = done;
    });

    return { promise, resolve };
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mocks.findOneAndUpdate.mockImplementation(async (filter) => {
        if (filter.status === "draft") {
            return {
                _id: input.versionId,
                definitionRevision: 3,
            };
        }

        if (filter.status === "publishing") {
            return { status: "draft" };
        }

        return null;
    });

    mocks.generateSpec.mockResolvedValue({
        openapi: "3.1.0",
    });

    mocks.validateSpec.mockResolvedValue({ valid: true });
    mocks.verifyOwnership.mockResolvedValue(true);
    mocks.activateVersion.mockResolvedValue({
        _id: input.versionId,
        status: "active",
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("publishing heartbeat failure", () => {
    it("aborts activation when heartbeat loses ownership", async () => {
        const validation = waitForValidation();

        mocks.validateDefinition.mockReturnValue(validation.promise);
        mocks.renewLock.mockResolvedValue(false);

        const publishing = publishValidatedAPIVersion(input);

        // Allow the initial lock acquisition to finish.
        await vi.waitFor(
            () => {
                expect(mocks.validateDefinition).toHaveBeenCalledOnce();
            },
            { interval: 1 }
        );

        // Trigger the heartbeat while validation is pending.
        await vi.advanceTimersByTimeAsync(60_000);

        expect(mocks.renewLock).toHaveBeenCalledOnce();

        // Complete validation so publishing reaches the failure check.
        validation.resolve({ valid: true });

        await expect(publishing).rejects.toThrow(
            "Publishing aborted: heartbeat lost lock ownership"
        );

        expect(mocks.activateVersion).not.toHaveBeenCalled();
        expect(mocks.verifyOwnership).not.toHaveBeenCalled();

        // The cleanup must use the acquired token.
        const cleanupCalls = mocks.findOneAndUpdate.mock.calls.filter(
            ([filter]) => filter.status === "publishing"
        );

        expect(cleanupCalls).toHaveLength(1);
        expect(cleanupCalls[0][0].publishingToken).toBeTruthy();
    });

    it("aborts activation when heartbeat renewal throws", async () => {
        const validation = waitForValidation();

        mocks.validateDefinition.mockReturnValue(validation.promise);
        mocks.renewLock.mockRejectedValue(
            new Error("Simulated MongoDB outage")
        );

        const publishing = publishValidatedAPIVersion(input);

        await vi.waitFor(
            () => {
                expect(mocks.validateDefinition).toHaveBeenCalledOnce();
            },
            { interval: 1 }
        );

        await vi.advanceTimersByTimeAsync(60_000);

        validation.resolve({ valid: true });

        await expect(publishing).rejects.toThrow(
            "Publishing aborted: heartbeat renewal failed"
        );

        expect(mocks.activateVersion).not.toHaveBeenCalled();
    });

    it("releases the lock exactly once after validation failure", async () => {
        mocks.validateDefinition.mockResolvedValue({
            valid: false,
            errors: [{ message: "No endpoints defined" }],
        });

        const result = await publishValidatedAPIVersion(input);

        expect(result.success).toBe(false);
        expect(result.stage).toBe("definition_validation");

        const cleanupCalls = mocks.findOneAndUpdate.mock.calls.filter(
            ([filter]) => filter.status === "publishing"
        );

        expect(cleanupCalls).toHaveLength(1);

        const cleanupFilter = cleanupCalls[0][0];

        expect(cleanupFilter.publishingToken).toBeTruthy();
        expect(cleanupFilter._id).toBe(input.versionId);
        expect(cleanupFilter.organizationId).toBe(input.organizationId);
        expect(cleanupFilter.projectId).toBe(input.projectId);
        expect(cleanupFilter.apiId).toBe(input.apiId);

        expect(mocks.activateVersion).not.toHaveBeenCalled();
        expect(mocks.verifyOwnership).not.toHaveBeenCalled();
    });

    it("does not release the lock after successful activation", async () => {
        mocks.validateDefinition.mockResolvedValue({
            valid: true,
        });

        mocks.renewLock.mockResolvedValue(true);

        const result = await publishValidatedAPIVersion(input);

        expect(result.success).toBe(true);
        expect(result.stage).toBe("published");

        const cleanupCalls = mocks.findOneAndUpdate.mock.calls.filter(
            ([filter]) => filter.status === "publishing"
        );

        expect(cleanupCalls).toHaveLength(0);
        expect(mocks.verifyOwnership).toHaveBeenCalledOnce();
        expect(mocks.activateVersion).toHaveBeenCalledOnce();
    });
});