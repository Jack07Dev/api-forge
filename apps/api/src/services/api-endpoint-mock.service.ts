
import APIEndpoint from "../models/APIEndpoint.js";
import APIEndpointMockResponse from "../models/APIEndpointMockResponse.js";

import {
    withDraftVersionTransaction,
} from "./api-version-guard.service.js";

import {
    validateMockResponse,
} from "../runtime/validators/mock-response.validator.js";

interface MockScope {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    endpointId: string;
}

interface MockInput {
    statusCode: unknown;
    responseBody: unknown;
}

// Scope endpoint queries to the correct organization,
// project, API, version, and endpoint.
const getEndpointFilter = (scope: MockScope) => ({
    _id: scope.endpointId,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    apiId: scope.apiId,
    apiVersionId: scope.apiVersionId,
    status: { $ne: "archived" as const },
});

// Scope mock queries to the same endpoint.
const getMockFilter = (scope: MockScope) => ({
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    apiId: scope.apiId,
    apiVersionId: scope.apiVersionId,
    endpointId: scope.endpointId,
});

// ---------------------------------------------
// CREATE MOCK RESPONSE
// ---------------------------------------------
export const createEndpointMock = async (
    scope: MockScope,
    input: MockInput
) => {
    const validatedInput = validateMockResponse(input);

    return withDraftVersionTransaction(
        scope,
        async (session) => {
            const endpoint = await APIEndpoint.findOne(
                getEndpointFilter(scope)
            ).session(session);

            if (!endpoint) {
                throw new Error("API endpoint not found");
            }

            const existing =
                await APIEndpointMockResponse.findOne(
                    getMockFilter(scope)
                ).session(session);

            if (existing) {
                throw new Error("Mock response already exists");
            }

            const [mock] = await APIEndpointMockResponse.create(
                [
                    {
                        ...getMockFilter(scope),
                        statusCode: validatedInput.statusCode,
                        responseBody: validatedInput.responseBody,
                    },
                ],
                { session }
            );

            return mock;
        }
    );
};

// ---------------------------------------------
// GET MOCK RESPONSE
// ---------------------------------------------
export const getEndpointMock = async (
    scope: MockScope
) => {
    const endpoint = await APIEndpoint.findOne(
        getEndpointFilter(scope)
    );

    if (!endpoint) {
        throw new Error("API endpoint not found");
    }

    return APIEndpointMockResponse.findOne(
        getMockFilter(scope)
    );
};

// ---------------------------------------------
// UPDATE MOCK RESPONSE
// ---------------------------------------------
export const updateEndpointMock = async (
    scope: MockScope,
    input: MockInput
) => {
    const validatedInput = validateMockResponse(input);

    return withDraftVersionTransaction(
        scope,
        async (session) => {
            const endpoint = await APIEndpoint.findOne(
                getEndpointFilter(scope)
            ).session(session);

            if (!endpoint) {
                throw new Error("API endpoint not found");
            }

            const updated =
                await APIEndpointMockResponse.findOneAndUpdate(
                    getMockFilter(scope),
                    {
                        $set: {
                            statusCode: validatedInput.statusCode,
                            responseBody: validatedInput.responseBody,
                        },
                    },
                    {
                        returnDocument: "after",
                        runValidators: true,
                        session,
                    }
                );

            if (!updated) {
                throw new Error("Mock response not found");
            }

            return updated;
        }
    );
};

// ---------------------------------------------
// DELETE MOCK RESPONSE
// ---------------------------------------------
export const deleteEndpointMock = async (
    scope: MockScope
) => {
    return withDraftVersionTransaction(
        scope,
        async (session) => {
            const endpoint = await APIEndpoint.findOne(
                getEndpointFilter(scope)
            ).session(session);

            if (!endpoint) {
                throw new Error("API endpoint not found");
            }

            const deleted =
                await APIEndpointMockResponse.findOneAndDelete(
                    getMockFilter(scope),
                    { session }
                );

            if (!deleted) {
                throw new Error("Mock response not found");
            }

            return deleted;
        }
    );
};
