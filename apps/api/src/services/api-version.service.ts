import mongoose from "mongoose";
import APIVersion, {
    APIVersionStatus
} from "../models/APIVersion.js";
import API from "../models/API.js";

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

const isValidStatusTransition = (
    currentStatus: APIVersionStatus,
    nextStatus: APIVersionStatus
): boolean => {
    const allowedTransitions: Record<
        APIVersionStatus,
        APIVersionStatus[]
    > = {
        draft: ["active"],
        active: ["deprecated"],
        deprecated: ["archived"],
        archived: []
    };

    return allowedTransitions[currentStatus].includes(
        nextStatus
    );
};

export const updateAPIVersionStatus = async ({
    versionId,
    apiId,
    projectId,
    organizationId,
    status
}: UpdateAPIVersionStatusInput) => {
    const apiVersion = await APIVersion.findOne({
        _id: versionId,
        apiId,
        projectId,
        organizationId
    });

    if (!apiVersion) {
        throw new Error("API version not found");
    }

    if (apiVersion.status === status) {
        throw new Error(
            `API version is already ${status}`
        );
    }

    if (
        !isValidStatusTransition(
            apiVersion.status,
            status
        )
    ) {
        throw new Error(
            `Invalid status transition from ${apiVersion.status} to ${status}`
        );
    }

    if (status === "active") {
        const existingActiveVersion =
            await APIVersion.findOne({
                apiId,
                projectId,
                organizationId,
                status: "active",
                _id: {
                    $ne: versionId
                }
            });

        if (existingActiveVersion) {
            throw new Error(
                `API already has an active version: ${existingActiveVersion.versionLabel}`
            );
        }
    }

    if (status === "deprecated") {
        const replacementVersion =
            await APIVersion.findOne({
                apiId,
                projectId,
                organizationId,
                status: "active",
                _id: {
                    $ne: versionId
                }
            });

        if (!replacementVersion) {
            throw new Error(
                "Cannot deprecate the active version without another active version"
            );
        }
    }

    apiVersion.status = status;

    await apiVersion.save();

    return apiVersion;
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

    const updateData: {
        basePath?: string;
        description?: string;
    } = {};

    if (basePath !== undefined) {
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

    return APIVersion.findOneAndUpdate(
        {
            _id: versionId,
            apiId,
            projectId,
            organizationId
        },
        {
            $set: updateData
        },
        {
            new: true,
            runValidators: true
        }
    );
};

export const activateAPIVersion = async ({
    versionId,
    apiId,
    projectId,
    organizationId
}: ActivateAPIVersionInput) => {
    const session = await mongoose.startSession();

    try {
        let activatedVersion;

        await session.withTransaction(async () => {
            const apiVersion = await APIVersion.findOne({
                _id: versionId,
                apiId,
                projectId,
                organizationId
            }).session(session);

            if (!apiVersion) {
                throw new Error("API version not found");
            }

            if (apiVersion.status === "active") {
                throw new Error(
                    "API version is already active"
                );
            }

            if (apiVersion.status !== "draft") {
                throw new Error(
                    `Cannot activate API version from ${apiVersion.status} status`
                );
            }

            const currentActiveVersion =
                await APIVersion.findOne({
                    apiId,
                    projectId,
                    organizationId,
                    status: "active"
                }).session(session);

            if (currentActiveVersion) {
                currentActiveVersion.status = "deprecated";

                await currentActiveVersion.save({
                    session
                });
            }

            apiVersion.status = "active";

            await apiVersion.save({
                session
            });

            activatedVersion = apiVersion;
        });

        return activatedVersion;
    } finally {
        await session.endSession();
    }
};