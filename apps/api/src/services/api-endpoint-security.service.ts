import mongoose from "mongoose";

import APIEndpoint from "../models/APIEndpoint.js";
import APIEndpointSecurity from "../models/APIEndpointSecurity.js";

type SecurityType = "none" | "apiKey" | "bearer";

interface CreateEndpointSecurityInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    endpointId: string;
    createdBy: string;

    type: SecurityType;

    apiKey?: {
        name: string;
        in: "header";
    };

    bearer?: {
        bearerFormat?: string;
    };
}

interface GetEndpointSecurityInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    endpointId: string;
}

interface UpdateEndpointSecurityInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    endpointId: string;

    type: "none" | "apiKey" | "bearer";

    apiKey?: {
        name: string;
        in: "header";
    };

    bearer?: {
        bearerFormat?: string;
    };
}

interface DeleteEndpointSecurityInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    endpointId: string;
}

export const createEndpointSecurity = async (
    input: CreateEndpointSecurityInput,
) => {
    const {
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        endpointId,
        createdBy,
        type,
        apiKey,
        bearer,
    } = input;

    // Validate endpoint hierarchy
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        status: { $ne: "archived" },
    });

    if (!endpoint) {
        throw new Error("ENDPOINT_NOT_FOUND");
    }

    // Prevent duplicate configuration
    const existingSecurity = await APIEndpointSecurity.findOne({
        endpointId,
    });

    if (existingSecurity) {
        throw new Error("SECURITY_ALREADY_EXISTS");
    }

    // Validate API key configuration
    if (type === "apiKey") {
        if (
            !apiKey ||
            typeof apiKey.name !== "string" ||
            !apiKey.name.trim() ||
            apiKey.in !== "header"
        ) {
            throw new Error("INVALID_API_KEY_CONFIG");
        }
    }

    // Validate bearer configuration
    if (
        type === "bearer" &&
        bearer?.bearerFormat !== undefined &&
        (
            typeof bearer.bearerFormat !== "string" ||
            !bearer.bearerFormat.trim()
        )
    ) {
        throw new Error("INVALID_BEARER_CONFIG");
    }

    // Save security configuration
    const security = await APIEndpointSecurity.create({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        projectId: new mongoose.Types.ObjectId(projectId),
        apiId: new mongoose.Types.ObjectId(apiId),
        apiVersionId: new mongoose.Types.ObjectId(apiVersionId),
        endpointId: new mongoose.Types.ObjectId(endpointId),
        createdBy: new mongoose.Types.ObjectId(createdBy),

        type,

        ...(type === "apiKey"
            ? {
                apiKey: {
                    name: apiKey!.name.trim(),
                    in: "header",
                },
            }
            : {}),

        ...(type === "bearer" && bearer
            ? {
                bearer: {
                    ...(bearer.bearerFormat
                        ? {
                            bearerFormat: bearer.bearerFormat.trim(),
                        }
                        : {}),
                },
            }
            : {}),
    });

    return security;
};

export const getEndpointSecurity = async (
    input: GetEndpointSecurityInput,
) => {
    const {
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        endpointId,
    } = input;

    // Verify the endpoint belongs to the requested hierarchy
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        status: { $ne: "archived" },
    });

    if (!endpoint) {
        throw new Error("ENDPOINT_NOT_FOUND");
    }

    // Find the security configuration for this endpoint
    const security = await APIEndpointSecurity.findOne({
        endpointId,
        organizationId,
        projectId,
        apiId,
        apiVersionId,
    }).lean();

    if (!security) {
        throw new Error("SECURITY_NOT_FOUND");
    }

    return security;
};

export const updateEndpointSecurity = async (
    input: UpdateEndpointSecurityInput,
) => {
    const {
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        endpointId,
        type,
        apiKey,
        bearer,
    } = input;

    // 1. Verify endpoint hierarchy
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        status: { $ne: "archived" },
    });

    if (!endpoint) {
        throw new Error("ENDPOINT_NOT_FOUND");
    }

    // 2. Find existing security configuration
    const security = await APIEndpointSecurity.findOne({
        endpointId,
        organizationId,
        projectId,
        apiId,
        apiVersionId,
    });

    if (!security) {
        throw new Error("SECURITY_NOT_FOUND");
    }

    // 3. Validate security type and related configuration
    if (type === "apiKey") {
        if (
            !apiKey ||
            typeof apiKey.name !== "string" ||
            !apiKey.name.trim() ||
            apiKey.in !== "header"
        ) {
            throw new Error("INVALID_API_KEY_CONFIG");
        }
    }

    if (
        type === "bearer" &&
        bearer?.bearerFormat !== undefined &&
        (
            typeof bearer.bearerFormat !== "string" ||
            !bearer.bearerFormat.trim()
        )
    ) {
        throw new Error("INVALID_BEARER_CONFIG");
    }

    // 4. Replace the selected security configuration
    // and remove metadata belonging to the previous type.
    security.type = type;
    security.set("apiKey", undefined);
    security.set("bearer", undefined);

    if (type === "apiKey" && apiKey) {
        security.set("apiKey", {
            name: apiKey.name.trim(),
            in: "header",
        });
    }

    if (type === "bearer" && bearer) {
        security.set("bearer", {
            ...(bearer.bearerFormat
                ? { bearerFormat: bearer.bearerFormat.trim() }
                : {}),
        });
    }

    // 5. Save the updated configuration
    await security.save();

    return security;
};

export const deleteEndpointSecurity = async (
    input: DeleteEndpointSecurityInput,
) => {
    const {
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        endpointId,
    } = input;

    // 1. Verify endpoint hierarchy
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        status: { $ne: "archived" },
    });

    if (!endpoint) {
        throw new Error("ENDPOINT_NOT_FOUND");
    }

    // 2. Delete security configuration within the same hierarchy
    const deletedSecurity =
        await APIEndpointSecurity.findOneAndDelete({
            endpointId,
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        });

    if (!deletedSecurity) {
        throw new Error("SECURITY_NOT_FOUND");
    }

    // 3. Return deletion summary
    return {
        id: deletedSecurity._id,
        endpointId: deletedSecurity.endpointId,
        type: deletedSecurity.type,
    };
};