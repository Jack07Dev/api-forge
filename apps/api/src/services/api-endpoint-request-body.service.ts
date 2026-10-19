
import mongoose from "mongoose";
import APIEndpoint from "../models/APIEndpoint.js";
import APIEndpointRequestBody from "../models/APIEndpointRequestBody.js";
import APIModel from "../models/APIModel.js";
import { assertDraftAPIVersion, withDraftVersionTransaction } from "./api-version-guard.service.js";

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
    userId,
}: CreateRequestBodyInput) => {
    // Validate before starting the transaction.
    if (contentType !== "application/json") {
        throw new Error("Unsupported content type");
    }

    if (!mongoose.Types.ObjectId.isValid(modelId)) {
        throw new Error("Invalid model ID");
    }

    return withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        },
        async (session) => {
            // 1. Verify endpoint and ownership.
            const endpoint = await APIEndpoint.findOne({
                _id: endpointId,
                apiId,
                apiVersionId,
                projectId,
                organizationId,
                status: { $ne: "archived" },
            }).session(session);

            if (!endpoint) {
                throw new Error("API endpoint not found");
            }

            // 2. Only POST, PUT and PATCH support request bodies.
            if (!["POST", "PUT", "PATCH"].includes(endpoint.method)) {
                throw new Error(
                    "Request body is only supported for POST, PUT and PATCH endpoints"
                );
            }

            // 3. Verify API model belongs to the same API version.
            // APIModel uses versionId, not apiVersionId.
            const model = await APIModel.findOne({
                _id: modelId,
                apiId,
                versionId: apiVersionId,
                projectId,
                organizationId,
            }).session(session);

            if (!model) {
                throw new Error("API model not found");
            }

            // 4. Prevent duplicate request body configuration.
            const existing = await APIEndpointRequestBody.findOne({
                endpointId,
            }).session(session);

            if (existing) {
                throw new Error(
                    "Request body configuration already exists for this endpoint"
                );
            }

            // 5. Create using the same MongoDB session.
            const [requestBody] = await APIEndpointRequestBody.create(
                [
                    {
                        endpointId,
                        apiId,
                        apiVersionId,
                        projectId,
                        organizationId,
                        modelId,
                        contentType,
                        required: required ?? true,
                        createdBy: userId,
                    },
                ],
                { session }
            );

            return requestBody;
        }
    );
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
    required,
}: UpdateEndpointRequestBodyInput) => {
    // Validate supplied values before opening a transaction.
    if (
        contentType !== undefined &&
        contentType !== "application/json"
    ) {
        throw new Error("Unsupported content type");
    }

    if (
        modelId !== undefined &&
        !mongoose.Types.ObjectId.isValid(modelId)
    ) {
        throw new Error("Invalid model ID");
    }

    return withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        },
        async (session) => {
            // 1. Verify endpoint and ownership.
            const endpoint = await APIEndpoint.findOne({
                _id: endpointId,
                apiId,
                apiVersionId,
                projectId,
                organizationId,
                status: { $ne: "archived" },
            }).session(session);

            if (!endpoint) {
                throw new Error("API endpoint not found");
            }

            // 2. Find existing request body.
            const requestBody =
                await APIEndpointRequestBody.findOne({
                    endpointId,
                    apiId,
                    apiVersionId,
                    projectId,
                    organizationId,
                }).session(session);

            if (!requestBody) {
                throw new Error("Endpoint request body not found");
            }

            // 3. Validate replacement model.
            if (modelId !== undefined) {
                const model = await APIModel.findOne({
                    _id: modelId,
                    apiId,
                    versionId: apiVersionId,
                    projectId,
                    organizationId,
                }).session(session);

                if (!model) {
                    throw new Error("API model not found");
                }

                requestBody.modelId =
                    new mongoose.Types.ObjectId(modelId);
            }

            // 4. Apply updates.
            if (contentType !== undefined) {
                requestBody.contentType = contentType;
            }

            if (required !== undefined) {
                requestBody.required = required;
            }

            // 5. Save using the transaction session.
            await requestBody.save({ session });

            return requestBody;
        }
    );
};

export const deleteEndpointRequestBody = async ({
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId,
}: DeleteEndpointRequestBodyInput) => {
    return withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        },
        async (session) => {
            // 1. Verify endpoint and ownership.
            const endpoint = await APIEndpoint.findOne({
                _id: endpointId,
                apiId,
                apiVersionId,
                projectId,
                organizationId,
                status: { $ne: "archived" },
            }).session(session);

            if (!endpoint) {
                throw new Error("API endpoint not found");
            }

            // 2. Delete request-body configuration.
            const requestBody =
                await APIEndpointRequestBody.findOneAndDelete(
                    {
                        endpointId,
                        apiId,
                        apiVersionId,
                        projectId,
                        organizationId,
                    },
                    {
                        session,
                    }
                );

            if (!requestBody) {
                throw new Error("Endpoint request body not found");
            }

            return requestBody;
        }
    );
};