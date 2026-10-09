
import mongoose from "mongoose";

import APIEndpoint from "../models/APIEndpoint.js";
import APIModel from "../models/APIModel.js";
import APIEndpointResponse from "../models/APIEndpointResponse.js";

interface CreateEndpointResponseInput {
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;

    statusCode: number;
    description?: string;
    contentType?: string;
    modelId?: string;

    userId: string;
}

interface GetEndpointResponsesInput {
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
}

interface GetEndpointResponseByIdInput {
    responseId: string;
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
}

interface UpdateEndpointResponseInput {
    responseId: string;
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;

    statusCode?: number;
    description?: string;
    contentType?: string | null;
    modelId?: string | null;
}

interface DeleteEndpointResponseInput {
    responseId: string;
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
}


export const createEndpointResponse = async ({
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId,
    statusCode,
    description,
    contentType,
    modelId,
    userId
}: CreateEndpointResponseInput) => {
    // 1. Verify endpoint ownership and status
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,
        status: { $ne: "archived" }
    });

    if (!endpoint) {
        throw new Error("API endpoint not found");
    }

    // 2. Validate HTTP status code
    if (
        !Number.isInteger(statusCode) ||
        statusCode < 200 ||
        statusCode > 599
    ) {
        throw new Error("Invalid HTTP status code");
    }

    // 3. Validate content type
    if (
        contentType !== undefined &&
        contentType !== "application/json"
    ) {
        throw new Error("Unsupported content type");
    }

    // 4. No response body for 204 and 304
    if (
        [204, 304].includes(statusCode) &&
        (contentType !== undefined || modelId !== undefined)
    ) {
        throw new Error(
            "This HTTP status code cannot have a response body"
        );
    }

    // 5. Model and content type must be supplied together
    if (
        (modelId !== undefined && contentType === undefined) ||
        (contentType !== undefined && modelId === undefined)
    ) {
        throw new Error(
            "modelId and contentType must be provided together"
        );
    }

    // 6. Validate referenced API Model
    if (modelId !== undefined) {
        if (!mongoose.Types.ObjectId.isValid(modelId)) {
            throw new Error("Invalid model ID");
        }

        // Your existing APIModel uses versionId.
        const model = await APIModel.findOne({
            _id: modelId,
            apiId,
            versionId: apiVersionId,
            projectId,
            organizationId
        });

        if (!model) {
            throw new Error("API model not found");
        }
    }

    // 7. Prevent duplicate status codes
    const existing = await APIEndpointResponse.findOne({
        endpointId,
        statusCode
    });

    if (existing) {
        throw new Error(
            `Response configuration for status ${statusCode} already exists`
        );
    }

    // 8. Create response configuration
    return APIEndpointResponse.create({
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,
        statusCode,
        description: description?.trim(),
        contentType,
        modelId,
        createdBy: userId
    });
};

export const getEndpointResponses = async ({
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId
}: GetEndpointResponsesInput) => {
    // Verify the endpoint belongs to the correct hierarchy
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,
        status: { $ne: "archived" }
    });

    if (!endpoint) {
        throw new Error("API endpoint not found");
    }

    // Return response configurations sorted by status code
    return APIEndpointResponse.find({
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId
    })
        .sort({ statusCode: 1 })
        .lean();
};

export const getEndpointResponseById = async ({
    responseId,
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId
}: GetEndpointResponseByIdInput) => {
    // 1. Verify endpoint belongs to the correct hierarchy
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,
        status: { $ne: "archived" }
    });

    if (!endpoint) {
        throw new Error("API endpoint not found");
    }

    // 2. Find response configuration by ID
    const response = await APIEndpointResponse.findOne({
        _id: responseId,
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId
    }).lean();

    if (!response) {
        throw new Error("Endpoint response not found");
    }

    return response;
};

export const updateEndpointResponse = async ({
    responseId,
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId,
    statusCode,
    description,
    contentType,
    modelId
}: UpdateEndpointResponseInput) => {
    // 1. Verify endpoint and ownership
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,
        status: { $ne: "archived" }
    });

    if (!endpoint) {
        throw new Error("API endpoint not found");
    }

    // 2. Find response configuration
    const response = await APIEndpointResponse.findOne({
        _id: responseId,
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId
    });

    if (!response) {
        throw new Error("Endpoint response not found");
    }

    // 3. Calculate final values before saving
    const finalStatusCode = statusCode ?? response.statusCode;

    const finalContentType =
        contentType === undefined
            ? response.contentType
            : contentType;

    const finalModelId =
        modelId === undefined
            ? response.modelId?.toString()
            : modelId;

    // 4. Validate HTTP status code
    if (
        !Number.isInteger(finalStatusCode) ||
        finalStatusCode < 200 ||
        finalStatusCode > 599
    ) {
        throw new Error("Invalid HTTP status code");
    }

    // 5. Validate content type
    if (
        finalContentType !== undefined &&
        finalContentType !== null &&
        finalContentType !== "application/json"
    ) {
        throw new Error("Unsupported content type");
    }

    // 6. Model and content type must be provided together
    const hasModel =
        finalModelId !== undefined && finalModelId !== null;

    const hasContentType =
        finalContentType !== undefined && finalContentType !== null;

    if (hasModel !== hasContentType) {
        throw new Error(
            "modelId and contentType must be provided together"
        );
    }

    // 7. Status codes 204 and 304 cannot have response bodies
    if (
        [204, 304].includes(finalStatusCode) &&
        (hasModel || hasContentType)
    ) {
        throw new Error(
            "This HTTP status code cannot have a response body"
        );
    }

    // 8. Verify referenced model belongs to same API version
    if (hasModel && finalModelId) {
        if (!mongoose.Types.ObjectId.isValid(finalModelId)) {
            throw new Error("Invalid model ID");
        }

        const model = await APIModel.findOne({
            _id: finalModelId,
            apiId,
            versionId: apiVersionId,
            projectId,
            organizationId
        });

        if (!model) {
            throw new Error("API model not found");
        }
    }

    // 9. Prevent duplicate status codes
    if (finalStatusCode !== response.statusCode) {
        const existing = await APIEndpointResponse.findOne({
            _id: { $ne: responseId },
            endpointId,
            statusCode: finalStatusCode
        });

        if (existing) {
            throw new Error(
                `Response configuration for status ${finalStatusCode} already exists`
            );
        }
    }

    // 10. Apply updates
    response.statusCode = finalStatusCode;

    if (description !== undefined) {
        response.description = description.trim();
    }

    if (contentType !== undefined) {
        if (contentType === null) {
            response.contentType = undefined;
        } else {
            response.contentType = contentType;
        }
    }

    if (modelId !== undefined) {
        if (modelId === null) {
            response.modelId = undefined;
        } else {
            response.modelId = new mongoose.Types.ObjectId(modelId);
        }
    }

    await response.save();

    return response;
};

export const deleteEndpointResponse = async ({
    responseId,
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId
}: DeleteEndpointResponseInput) => {
    // Verify endpoint belongs to the correct hierarchy
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,
        status: { $ne: "archived" }
    });

    if (!endpoint) {
        throw new Error("API endpoint not found");
    }

    // Delete only the response configuration belonging
    // to the requested endpoint and hierarchy
    const deletedResponse =
        await APIEndpointResponse.findOneAndDelete({
            _id: responseId,
            endpointId,
            apiId,
            apiVersionId,
            projectId,
            organizationId
        });

    if (!deletedResponse) {
        throw new Error("Endpoint response not found");
    }

    return deletedResponse;
};
