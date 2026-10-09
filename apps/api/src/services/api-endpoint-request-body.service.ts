
import mongoose from "mongoose";
import APIEndpoint from "../models/APIEndpoint.js";
import APIEndpointRequestBody from "../models/APIEndpointRequestBody.js";
import APIModel from "../models/APIModel.js";

interface CreateRequestBodyInput {
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
    modelId: string;
    contentType: string;
    required?: boolean;
    userId: string;
}

interface GetEndpointRequestBodyInput {
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
}

interface UpdateEndpointRequestBodyInput {
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
    modelId?: string;
    contentType?: string;
    required?: boolean;
}

interface DeleteEndpointRequestBodyInput {
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
}



export const createEndpointRequestBody = async ({
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId,
    modelId,
    contentType,
    required,
    userId
}: CreateRequestBodyInput) => {
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

    // 2. Only POST, PUT, PATCH can have request bodies in this MVP
    if (!["POST", "PUT", "PATCH"].includes(endpoint.method)) {
        throw new Error(
            "Request body is only supported for POST, PUT and PATCH endpoints"
        );
    }

    // 3. Validate content type
    if (contentType !== "application/json") {
        throw new Error("Unsupported content type");
    }

    // 4. Validate model ID
    if (!mongoose.Types.ObjectId.isValid(modelId)) {
        throw new Error("Invalid model ID");
    }

    // 5. Verify API Model belongs to same API version
    // APIModel uses versionId, not apiVersionId
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

    // 6. Prevent duplicate request body configuration
    const existing = await APIEndpointRequestBody.findOne({
        endpointId
    });

    if (existing) {
        throw new Error(
            "Request body configuration already exists for this endpoint"
        );
    }

    // 7. Create configuration
    return APIEndpointRequestBody.create({
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,
        modelId,
        contentType,
        required: required ?? true,
        createdBy: userId
    });
};

export const getEndpointRequestBody = async ({
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId
}: GetEndpointRequestBodyInput) => {
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

    // Retrieve its request-body configuration
    const requestBody = await APIEndpointRequestBody.findOne({
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId
    }).lean();

    if (!requestBody) {
        throw new Error("Endpoint request body not found");
    }

    return requestBody;
};

export const updateEndpointRequestBody = async ({
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId,
    modelId,
    contentType,
    required
}: UpdateEndpointRequestBodyInput) => {
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

    // 2. Find existing request body
    const requestBody = await APIEndpointRequestBody.findOne({
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId
    });

    if (!requestBody) {
        throw new Error("Endpoint request body not found");
    }

    // 3. Validate content type if provided
    if (
        contentType !== undefined &&
        contentType !== "application/json"
    ) {
        throw new Error("Unsupported content type");
    }

    // 4. Validate replacement model if provided
    if (modelId !== undefined) {
        if (!mongoose.Types.ObjectId.isValid(modelId)) {
            throw new Error("Invalid model ID");
        }

        // Existing APIModel uses versionId
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

        requestBody.modelId = new mongoose.Types.ObjectId(modelId);
    }

    // 5. Apply changes
    if (contentType !== undefined) {
        requestBody.contentType = contentType;
    }

    if (required !== undefined) {
        requestBody.required = required;
    }

    await requestBody.save();

    return requestBody;
};

export const deleteEndpointRequestBody = async ({
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId
}: DeleteEndpointRequestBodyInput) => {
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

    // 2. Delete only the request-body configuration
    const requestBody =
        await APIEndpointRequestBody.findOneAndDelete({
            endpointId,
            apiId,
            apiVersionId,
            projectId,
            organizationId
        });

    if (!requestBody) {
        throw new Error("Endpoint request body not found");
    }

    return requestBody;
};
