import APIVersion from "../models/APIVersion.js";
import { activateAPIVersion } from "./api-version.service.js";
import {
    validateAPIVersionDefinition
} from "./api-definition-validation.service.js";

import {
    generateOpenAPISpec
} from "./openapi-generator.service.js";

import {
    validateOpenAPISpec
} from "./openapi-validation.service.js";
import { randomUUID } from "node:crypto";
import { renewPublishingLock } from "./api-publishing-heartbeat.service.js";
import { verifyPublishingLockOwnership } from "./api-publishing-ownership.service.js";

export interface PublishAPIVersionInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    versionId: string;
}

export const publishAPIVersion = async ({
    organizationId,
    projectId,
    apiId,
    versionId
}: PublishAPIVersionInput) => {

    // Step 1: Verify the API version
    const version = await APIVersion.findOne({
        _id: versionId,
        organizationId,
        projectId,
        apiId
    });

    if (!version) {
        throw new Error("API version not found");
    }

    // Step 2: Only draft versions can be published
    if (version.status !== "draft") {
        throw new Error(
            `Cannot publish API version with status ${version.status}`
        );
    }

    // Step 3: Validate API definitions
    const definitionValidation =
        await validateAPIVersionDefinition({
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId
        });

    if (!definitionValidation.valid) {
        return {
            success: false,
            stage: "definition_validation",
            message: "API definition validation failed",
            validation: definitionValidation
        };
    }

    // Step 4: Generate OpenAPI specification
    const specification = await generateOpenAPISpec({
        organizationId,
        projectId,
        apiId,
        versionId
    });

    // Step 5: Validate OpenAPI specification
    const openapiValidation =
        await validateOpenAPISpec(specification);

    if (!openapiValidation.valid) {
        return {
            success: false,
            stage: "openapi_validation",
            message: "OpenAPI specification validation failed",
            validation: openapiValidation
        };
    }

    // Step 6: Both validations passed
    return {
        success: true,
        stage: "validation_complete",
        message: "API version passed publishing validation",
        data: {
            versionId,
            versionLabel: version.versionLabel,
            status: version.status,
            endpointsChecked:
                definitionValidation.summary.endpointsChecked,
            warnings: definitionValidation.warnings,
            openapiVersion: specification.openapi
        }
    };
};


export const publishValidatedAPIVersion = async (
    input: PublishAPIVersionInput
) => {
    // Step 1: Acquire publishing lock
    const { publishingToken, definitionRevision } =
        await acquirePublishingLock(input);

    let publishedSuccessfully = false;

    // Heartbeat configuration
    const HEARTBEAT_INTERVAL_MS = 60 * 1000;

    let heartbeatStopped = false;
    let heartbeatInFlight: Promise<void> | undefined;
    let heartbeatFailure: Error | null = null;

    // Step 2: Start heartbeat renewal
    const heartbeatTimer = setInterval(() => {
        // Avoid overlapping renewals or renewing after failure
        if (
            heartbeatStopped ||
            heartbeatInFlight ||
            heartbeatFailure !== null
        ) {
            return;
        }

        heartbeatInFlight = (async () => {
            try {
                const renewed = await renewPublishingLock({
                    ...input,
                    publishingToken,
                    definitionRevision,
                });

                if (!renewed) {
                    heartbeatFailure = new Error(
                        "Publishing aborted: heartbeat lost lock ownership"
                    );
                }
            } catch (error) {
                heartbeatFailure = new Error(
                    "Publishing aborted: heartbeat renewal failed",
                    { cause: error }
                );
            }
        })().finally(() => {
            heartbeatInFlight = undefined;
        });
    }, HEARTBEAT_INTERVAL_MS);

    heartbeatTimer.unref?.();

    try {
        // Step 3: Validate API definition
        const definitionValidation =
            await validateAPIVersionDefinition({
                organizationId: input.organizationId,
                projectId: input.projectId,
                apiId: input.apiId,
                apiVersionId: input.versionId,
            });

        if (!definitionValidation.valid) {
            return {
                success: false,
                stage: "definition_validation",
                message: "API definition validation failed",
                validation: definitionValidation,
            };
        }

        // Step 4: Generate OpenAPI specification
        const specification = await generateOpenAPISpec({
            organizationId: input.organizationId,
            projectId: input.projectId,
            apiId: input.apiId,
            versionId: input.versionId,
        });

        // Step 5: Validate OpenAPI specification
        const openapiValidation =
            await validateOpenAPISpec(specification);

        if (!openapiValidation.valid) {
            return {
                success: false,
                stage: "openapi_validation",
                message: "OpenAPI specification validation failed",
                validation: openapiValidation,
            };
        }

        // Step 6: Stop scheduling heartbeat renewals
        // before final ownership verification
        heartbeatStopped = true;
        clearInterval(heartbeatTimer);

        // Wait for any heartbeat already in progress
        if (heartbeatInFlight) {
            await heartbeatInFlight;
        }

        // Step 7: Abort if heartbeat renewal failed
        if (heartbeatFailure !== null) {
            throw heartbeatFailure;
        }

        // Step 8: Verify lock ownership and revision
        const ownsLock = await verifyPublishingLockOwnership({
            ...input,
            publishingToken,
            definitionRevision,
        });

        if (!ownsLock) {
            throw new Error(
                "Publishing aborted: lock ownership was lost"
            );
        }

        // Step 9: Activate validated API version
        const activatedVersion = await activateAPIVersion({
            organizationId: input.organizationId,
            projectId: input.projectId,
            apiId: input.apiId,
            versionId: input.versionId,
            publishingToken,
            definitionRevision,
        });

        // Activation succeeded
        publishedSuccessfully = true;

        return {
            success: true,
            stage: "published",
            message: "API version published successfully",
            data: {
                versionId: activatedVersion._id,
                status: activatedVersion.status,
                definitionRevision,
            },
        };
    } finally {
        // Step 10: Always stop heartbeat scheduling
        heartbeatStopped = true;
        clearInterval(heartbeatTimer);

        // Wait for an in-progress heartbeat
        if (heartbeatInFlight) {
            await heartbeatInFlight;
        }

        // Step 11: Release lock if publishing failed
        if (!publishedSuccessfully) {
            try {
                await releasePublishingLock({
                    ...input,
                    publishingToken,
                });
            } catch (cleanupError) {
                console.error(
                    "Failed to release publishing lock:",
                    cleanupError
                );
            }
        }
    }
};


export const acquirePublishingLock = async (
    input: PublishAPIVersionInput
) => {
    const {
        organizationId,
        projectId,
        apiId,
        versionId
    } = input;

    const publishingToken = randomUUID();

    const version = await APIVersion.findOneAndUpdate(
        {
            _id: versionId,
            organizationId,
            projectId,
            apiId,
            status: "draft"
        },
        {
            $set: {
                status: "publishing",
                publishingToken,
                publishingStartedAt: new Date()
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!version) {
        throw new Error(
            "API version not found or is not available for publishing"
        );
    }

    return {
        version,
        publishingToken,
        definitionRevision: version.definitionRevision,
    };
};

export const releasePublishingLock = async (
    input: PublishAPIVersionInput & {
        publishingToken: string;
    }
) => {
    const {
        organizationId,
        projectId,
        apiId,
        versionId,
        publishingToken
    } = input;

    const version = await APIVersion.findOneAndUpdate(
        {
            _id: versionId,
            organizationId,
            projectId,
            apiId,
            status: "publishing",
            publishingToken
        },
        {
            $set: {
                status: "draft"
            },
            $unset: {
                publishingToken: "",
                publishingStartedAt: ""
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!version) {
        throw new Error(
            "Publishing lock not found or token does not match"
        );
    }

    return version;
};

const PUBLISHING_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export const recoverStalePublishingLock = async (
    input: PublishAPIVersionInput
) => {
    const cutoff = new Date(
        Date.now() - PUBLISHING_LOCK_TIMEOUT_MS
    );

    // Find a publishing operation whose lock has expired.
    const staleVersion = await APIVersion.findOne({
        _id: input.versionId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        apiId: input.apiId,
        status: "publishing",
        publishingStartedAt: { $lt: cutoff },
        publishingToken: { $type: "string" }
    }).select("publishingToken");

    if (!staleVersion?.publishingToken) {
        return {
            recovered: false,
            message: "No stale publishing lock found"
        };
    }

    // Release only the exact lock observed above.
    const recoveredVersion =
        await APIVersion.findOneAndUpdate(
            {
                _id: input.versionId,
                organizationId: input.organizationId,
                projectId: input.projectId,
                apiId: input.apiId,
                status: "publishing",
                publishingToken:
                    staleVersion.publishingToken,
                publishingStartedAt: { $lt: cutoff }
            },
            {
                $set: {
                    status: "draft"
                },
                $unset: {
                    publishingToken: "",
                    publishingStartedAt: ""
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

    return {
        recovered: Boolean(recoveredVersion),
        message: recoveredVersion
            ? "Stale publishing lock recovered successfully"
            : "Publishing lock changed before recovery"
    };
};