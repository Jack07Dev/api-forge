import mongoose from "mongoose";
import APIVersion, {
    APIVersionStatus
} from "../models/APIVersion.js";
import API from "../models/API.js";
import { withDraftVersionTransaction } from "./api-version-guard.service.js";

interface CreateAPIVersionInput {
    apiId: string;
    projectId: string;
    organizationId: string;
    userId: string;
}

interface UpdateAPIVersionStatusInput {
    versionId: string;
    apiId: string;
    projectId: string;
    organizationId: string;
    status: APIVersionStatus;
}

interface UpdateAPIVersionInput {
    versionId: string;
    apiId: string;
    projectId: string;
    organizationId: string;
    basePath?: string;
    description?: string;
}

interface ActivateAPIVersionInput {
    versionId: string;
    apiId: string;
    projectId: string;
    organizationId: string;
    publishingToken: string;
    definitionRevision: number;
    now?: () => number;
}


export const createAPIVersion = async ({
    apiId,
    projectId,
    organizationId,
    userId
}: CreateAPIVersionInput) => {
    // Verify API belongs to the correct project and organization
    const api = await API.findOne({
        _id: apiId,
        projectId,
        organizationId
    });

    if (!api) {
        throw new Error("API not found");
    }

    // Find the latest version
    const latestVersion = await APIVersion.findOne({
        apiId,
        projectId,
        organizationId
    }).sort({ version: -1 });

    const nextVersion = latestVersion
        ? latestVersion.version + 1
        : 1;

    const versionLabel = `v${nextVersion}`;
    const basePath = `/api/${versionLabel}`;

    const apiVersion = await APIVersion.create({
        apiId,
        projectId,
        organizationId,
        version: nextVersion,
        versionLabel,
        basePath,
        status: "draft",
        createdBy: userId
    });

    return apiVersion;
};

export const getAPIVersions = async (
    apiId: string,
    projectId: string,
    organizationId: string
) => {
    return APIVersion.find({
        apiId,
        projectId,
        organizationId
    })
        .sort({ version: 1 })
        .select(
            "_id apiId projectId organizationId version versionLabel status createdBy createdAt updatedAt"
        );
};

export const getAPIVersionById = async (
    versionId: string,
    apiId: string,
    projectId: string,
    organizationId: string
) => {
    return APIVersion.findOne({
        _id: versionId,
        apiId,
        projectId,
        organizationId
    });
};

export const updateAPIVersionStatus = async ({
    versionId,
    apiId,
    projectId,
    organizationId,
    status
}: UpdateAPIVersionStatusInput) => {

    // Direct publishing and activation are forbidden.
    if (status === "active" || status === "publishing") {
        throw new Error(
            "Use the API publishing workflow to change publishing or active status"
        );
    }

    // The only supported administrative transitions.
    const previousStatus: Record<string, APIVersionStatus> = {
        deprecated: "active",
        archived: "deprecated"
    };

    const expectedStatus = previousStatus[status];

    if (!expectedStatus) {
        throw new Error(
            `Direct transition to ${status} is not allowed`
        );
    }

    return mongoose.connection.transaction(async (session) => {

        const apiVersion = await APIVersion.findOne({
            _id: versionId,
            apiId,
            projectId,
            organizationId
        }).session(session);

        if (!apiVersion) {
            throw new Error("API version not found");
        }

        if (apiVersion.status !== expectedStatus) {
            throw new Error(
                `Invalid status transition from ${apiVersion.status} to ${status}`
            );
        }

        // Deprecation is allowed only when another active
        // version exists.
        if (status === "deprecated") {
            const replacementVersion = await APIVersion.findOne({
                apiId,
                projectId,
                organizationId,
                status: "active",
                _id: { $ne: versionId }
            }).session(session);

            if (!replacementVersion) {
                throw new Error(
                    "Cannot deprecate the active version without another active version"
                );
            }
        }

        const updatedVersion = await APIVersion.findOneAndUpdate(
            {
                _id: versionId,
                apiId,
                projectId,
                organizationId,
                status: expectedStatus
            },
            {
                $set: { status }
            },
            {
                returnDocument: "after",
                runValidators: true,
                session
            }
        );

        if (!updatedVersion) {
            throw new Error(
                "API version status changed during the operation"
            );
        }

        return updatedVersion;
    });
};

export const updateAPIVersion = async ({
    versionId,
    apiId,
    projectId,
    organizationId,
    basePath,
    description
}: UpdateAPIVersionInput) => {
    const apiVersion = await APIVersion.findOne({
        _id: versionId,
        apiId,
        projectId,
        organizationId
    });

    if (!apiVersion) {
        throw new Error("API version not found");
    }

    // Published versions must not be edited directly.
    if (apiVersion.status !== "draft") {
        throw new Error(
            `Cannot modify API version with status ${apiVersion.status}`
        );
    }

    const updateData: {
        basePath?: string;
        description?: string;
    } = {};

    if (basePath !== undefined) {
        if (typeof basePath !== "string") {
            throw new Error("Base path must be a string");
        }

        const trimmedBasePath = basePath.trim();

        if (!trimmedBasePath) {
            throw new Error("Base path cannot be empty");
        }

        if (!trimmedBasePath.startsWith("/")) {
            throw new Error(
                "Base path must start with /"
            );
        }

        if (trimmedBasePath.length > 200) {
            throw new Error(
                "Base path cannot exceed 200 characters"
            );
        }

        if (trimmedBasePath.includes(" ")) {
            throw new Error(
                "Base path cannot contain spaces"
            );
        }

        if (trimmedBasePath.includes("//")) {
            throw new Error(
                "Base path cannot contain consecutive slashes"
            );
        }

        if (
            !/^\/[a-zA-Z0-9._~!$&'()*+,;=:@%\/-]*$/.test(
                trimmedBasePath
            )
        ) {
            throw new Error(
                "Base path contains invalid characters"
            );
        }

        updateData.basePath = trimmedBasePath.replace(/\/+$/, "");
    }

    if (description !== undefined) {
        if (typeof description !== "string") {
            throw new Error("Description must be a string");
        }

        const trimmedDescription = description.trim();

        if (trimmedDescription.length > 500) {
            throw new Error(
                "Description cannot exceed 500 characters"
            );
        }

        updateData.description =
            trimmedDescription;
    }

    if (Object.keys(updateData).length === 0) {
        throw new Error(
            "At least one field is required"
        );
    }

    const updatedVersion = await withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId,
        },
        async (session) => {
            const updated = await APIVersion.findOneAndUpdate(
                {
                    _id: versionId,
                    apiId,
                    projectId,
                    organizationId,
                    status: "draft",
                },
                {
                    $set: updateData,
                },
                {
                    returnDocument: "after",
                    runValidators: true,
                    session,
                }
            );

            if (!updated) {
                throw new Error(
                    "API version not found or is no longer editable"
                );
            }

            return updated;
        }
    );

    return updatedVersion;
};

export const activateAPIVersion = async ({
    versionId,
    apiId,
    projectId,
    organizationId,
    publishingToken,
    definitionRevision,
    now = Date.now
}: ActivateAPIVersionInput) => {
    return mongoose.connection.transaction(async (session) => {

        // Publishing lock must have been renewed within 10 minutes.
        const publishingLockCutoff = new Date(
            now() - 10 * 60 * 1000
        );

        // Step 1: Verify lock ownership and expiration.
        const apiVersion = await APIVersion.findOne({
            _id: versionId,
            apiId,
            projectId,
            organizationId,
            status: "publishing",
            publishingToken,
            definitionRevision,
            publishingStartedAt: {
                $gte: publishingLockCutoff,
            },
        }).session(session);

        if (!apiVersion) {
            throw new Error(
                "Publishing lock is invalid, expired, or API definition has changed"
            );
        }

        // Step 2: Find the currently active version.
        const currentActiveVersion = await APIVersion.findOne({
            apiId,
            projectId,
            organizationId,
            status: "active",
            _id: { $ne: versionId },
        }).session(session);

        // Step 3: Deprecate the previous active version.
        if (currentActiveVersion) {
            currentActiveVersion.status = "deprecated";
            await currentActiveVersion.save({ session });
        }

        // Step 4: Recheck lock ownership and expiration.
        const activatedVersion = await APIVersion.findOneAndUpdate(
            {
                _id: versionId,
                apiId,
                projectId,
                organizationId,
                status: "publishing",
                publishingToken,
                definitionRevision,
                publishingStartedAt: {
                    $gte: new Date(now() - 10 * 60 * 1000),
                },
            },
            {
                $set: {
                    status: "active",
                },
                $unset: {
                    publishingToken: "",
                    publishingStartedAt: "",
                },
            },
            {
                returnDocument: "after",
                runValidators: true,
                session,
            }
        );

        if (!activatedVersion) {
            throw new Error("Publishing lock expired or ownership changed");
        }

        return activatedVersion;
    });
};