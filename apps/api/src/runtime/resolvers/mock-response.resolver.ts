import mongoose from "mongoose";

import APIEndpointMockResponse from "../../models/APIEndpointMockResponse.js";

import { validateMockResponse } from "../validators/mock-response.validator.js";

interface ResolveMockResponseInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    endpointId: string;
}

export const resolveMockResponse = async ({
    organizationId,
    projectId,
    apiId,
    apiVersionId,
    endpointId,
}: ResolveMockResponseInput) => {
    const ids = [
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        endpointId,
    ];

    if (!ids.every((id) => mongoose.isValidObjectId(id))) {
        throw new Error("INVALID_MOCK_RESPONSE_IDENTIFIERS");
    }

    const mockResponse = await APIEndpointMockResponse.findOne({
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        endpointId,
    }).lean();

    if (!mockResponse) {
        return null;
    }

    const validated = validateMockResponse({
        statusCode: mockResponse.statusCode,
        responseBody: mockResponse.responseBody,
    });

    return {
        statusCode: validated.statusCode,
        responseBody: validated.responseBody,
    };
};