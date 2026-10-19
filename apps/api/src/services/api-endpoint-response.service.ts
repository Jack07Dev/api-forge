
import mongoose from "mongoose";

import APIEndpoint from "../models/APIEndpoint.js";
import APIModel from "../models/APIModel.js";
import APIEndpointResponse from "../models/APIEndpointResponse.js";
import {
    withDraftVersionTransaction,
} from "./api-version-guard.service.js";

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
    userId,
}: CreateEndpointResponseInput) => {
    if (
        !Number.isInteger(statusCode) ||
        statusCode < 200 ||
        statusCode > 599
    ) {
        throw new Error("Invalid HTTP status code");
    }

    if (
        contentType !== undefined &&
        contentType !== "application/json"
    ) {
        throw new Error("Unsupported content type");
    }

    if (
        [204, 304].includes(statusCode) &&
        (contentType !== undefined || modelId !== undefined)
    ) {
        throw new Error(
            "This HTTP status code cannot have a response body"
        );
    }

    if (
        (modelId !== undefined && contentType === undefined) ||
        (contentType !== undefined && modelId === undefined)
    ) {
        throw new Error(
            "modelId and contentType must be provided together"
        );
    }

    if (
        modelId !== undefined &&
        !mongoose.Types.ObjectId.isValid(modelId)
    ) {
        throw new Error("Invalid model ID");
    }

    return withDraftVersionTransaction(
        { organizationId, projectId, apiId, apiVersionId },
        async (session) => {
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
            }

            const existing = await APIEndpointResponse.findOne({
                endpointId,
                statusCode,
            }).session(session);

            if (existing) {
                throw new Error(
                    `Response configuration for status ${statusCode} already exists`
                );
            }

            const [response] = await APIEndpointResponse.create(
                [
                    {
                        endpointId,
                        apiId,
                        apiVersionId,
                        projectId,
                        organizationId,
                        statusCode,
                        description: description?.trim(),
                        contentType,
                        modelId,
                        createdBy: userId,
                    },
                ],
                { session }
            );

            return response;
        }
    );
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
    modelId,
}: UpdateEndpointResponseInput) => {
    return withDraftVersionTransaction(
        { organizationId, projectId, apiId, apiVersionId },
        async (session) => {
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

            const response = await APIEndpointResponse.findOne({
                _id: responseId,
                endpointId,
                apiId,
                apiVersionId,
                projectId,
                organizationId,
            }).session(session);

            if (!response) {
                throw new Error("Endpoint response not found");
            }

            const finalStatusCode = statusCode ?? response.statusCode;

            const finalContentType =
                contentType === undefined
                    ? response.contentType
                    : contentType;

            const finalModelId =
                modelId === undefined
                    ? response.modelId?.toString()
                    : modelId;

            if (
                !Number.isInteger(finalStatusCode) ||
                finalStatusCode < 200 ||
                finalStatusCode > 599
            ) {
                throw new Error("Invalid HTTP status code");
            }

            if (
                finalContentType !== undefined &&
                finalContentType !== null &&
                finalContentType !== "application/json"
            ) {
                throw new Error("Unsupported content type");
            }

            const hasModel =
                finalModelId !== undefined && finalModelId !== null;

            const hasContentType =
                finalContentType !== undefined &&
                finalContentType !== null;

            if (hasModel !== hasContentType) {
                throw new Error(
                    "modelId and contentType must be provided together"
                );
            }

            if (
                [204, 304].includes(finalStatusCode) &&
                (hasModel || hasContentType)
            ) {
                throw new Error(
                    "This HTTP status code cannot have a response body"
                );
            }

            if (hasModel && finalModelId) {
                if (!mongoose.Types.ObjectId.isValid(finalModelId)) {
                    throw new Error("Invalid model ID");
                }

                const model = await APIModel.findOne({
                    _id: finalModelId,
                    apiId,
                    versionId: apiVersionId,
                    projectId,
                    organizationId,
                }).session(session);

                if (!model) {
                    throw new Error("API model not found");
                }
            }

            if (finalStatusCode !== response.statusCode) {
                const existing = await APIEndpointResponse.findOne({
                    _id: { $ne: responseId },
                    endpointId,
                    statusCode: finalStatusCode,
                }).session(session);

                if (existing) {
                    throw new Error(
                        `Response configuration for status ${finalStatusCode} already exists`
                    );
                }
            }

            response.statusCode = finalStatusCode;

            if (description !== undefined) {
                response.description = description.trim();
            }

            if (contentType !== undefined) {
                response.contentType =
                    contentType === null ? undefined : contentType;
            }

            if (modelId !== undefined) {
                response.modelId =
                    modelId === null
                        ? undefined
                        : new mongoose.Types.ObjectId(modelId);
            }

            await response.save({ session });

            return response;
        }
    );
};

export const deleteEndpointResponse = async ({
    responseId,
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId,
}: DeleteEndpointResponseInput) => {
    return withDraftVersionTransaction(
        { organizationId, projectId, apiId, apiVersionId },
        async (session) => {
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

            const deletedResponse =
                await APIEndpointResponse.findOneAndDelete(
                    {
                        _id: responseId,
                        endpointId,
                        apiId,
                        apiVersionId,
                        projectId,
                        organizationId,
                    },
                    { session }
                );

            if (!deletedResponse) {
                throw new Error("Endpoint response not found");
            }

            return deletedResponse;
        }
    );
};