import mongoose from "mongoose";

import APIEndpoint from "../models/APIEndpoint.js";
import APIEndpointParameter from "../models/APIEndpointParameter.js";
import APIEndpointRequestBody from "../models/APIEndpointRequestBody.js";
import APIEndpointResponse from "../models/APIEndpointResponse.js";
import APIEndpointSecurity from "../models/APIEndpointSecurity.js";
import APIModel from "../models/APIModel.js";
import APIVersion from "../models/APIVersion.js";

export interface ValidationIssue {
    severity: "error" | "warning";
    code: string;
    message: string;
    endpointId?: string;
    path?: string;
}

interface ValidateAPIVersionInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
}

export const validateAPIVersionDefinition = async (
    input: ValidateAPIVersionInput,
) => {
    const {
        organizationId,
        projectId,
        apiId,
        apiVersionId,
    } = input;

    // 1. Verify API version hierarchy
    const version = await APIVersion.findOne({
        _id: apiVersionId,
        organizationId,
        projectId,
        apiId,
    }).lean();

    if (!version) {
        throw new Error("API_VERSION_NOT_FOUND");
    }

    // 2. Load active API endpoint definitions
    const endpoints = await APIEndpoint.find({
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        status: { $ne: "archived" },
    }).lean();

    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (endpoints.length === 0) {
        errors.push({
            severity: "error",
            code: "NO_ENDPOINTS",
            message: "API version must contain at least one endpoint.",
        });
    }

    const endpointIds = endpoints.map((endpoint) => endpoint._id);

    // 3. Load associated configurations
    const [
        parameters,
        requestBodies,
        responses,
        securities,
        models,
    ] = await Promise.all([
        APIEndpointParameter.find({
            endpointId: { $in: endpointIds },
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        }).lean(),

        APIEndpointRequestBody.find({
            endpointId: { $in: endpointIds },
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        }).lean(),

        APIEndpointResponse.find({
            endpointId: { $in: endpointIds },
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        }).lean(),

        APIEndpointSecurity.find({
            endpointId: { $in: endpointIds },
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        }).lean(),

        // APIModel uses versionId rather than apiVersionId
        APIModel.find({
            organizationId,
            projectId,
            apiId,
            versionId: apiVersionId,
        }).lean(),
    ]);

    const modelIds = new Set(
        models.map((model) => String(model._id)),
    );

    const seenEndpoints = new Set<string>();

    for (const endpoint of endpoints) {
        const endpointId = String(endpoint._id);
        const path = endpoint.path;
        const method = endpoint.method;

        // 4. Detect duplicate method + path combinations
        const endpointKey = `${method}:${path}`;

        if (seenEndpoints.has(endpointKey)) {
            errors.push({
                severity: "error",
                code: "DUPLICATE_ENDPOINT",
                endpointId,
                path,
                message: `Duplicate endpoint: ${method} ${path}`,
            });
        } else {
            seenEndpoints.add(endpointKey);
        }

        const endpointParameters = parameters.filter(
            (param) => String(param.endpointId) === endpointId,
        );

        const endpointResponses = responses.filter(
            (response) => String(response.endpointId) === endpointId,
        );

        const endpointSecurity = securities.find(
            (security) => String(security.endpointId) === endpointId,
        );

        const endpointRequestBody = requestBodies.find(
            (body) => String(body.endpointId) === endpointId,
        );

        // 5. Validate path parameters
        const pathParameterNames = [
            ...path.matchAll(/\{([^{}]+)\}/g),
        ].map((match) => match[1]);

        for (const parameterName of pathParameterNames) {
            const matchingParameter = endpointParameters.find(
                (param) =>
                    param.location === "path" &&
                    param.name === parameterName,
            );

            if (!matchingParameter) {
                errors.push({
                    severity: "error",
                    code: "MISSING_PATH_PARAMETER",
                    endpointId,
                    path,
                    message: `Path parameter '${parameterName}' is not defined.`,
                });
            } else if (!matchingParameter.required) {
                errors.push({
                    severity: "error",
                    code: "PATH_PARAMETER_NOT_REQUIRED",
                    endpointId,
                    path,
                    message: `Path parameter '${parameterName}' must be required.`,
                });
            }
        }

        // 6. Validate response definitions
        if (endpointResponses.length === 0) {
            errors.push({
                severity: "error",
                code: "MISSING_RESPONSE",
                endpointId,
                path,
                message: `Endpoint ${method} ${path} has no response definition.`,
            });
        }

        for (const response of endpointResponses) {
            if (
                response.modelId &&
                !modelIds.has(String(response.modelId))
            ) {
                errors.push({
                    severity: "error",
                    code: "INVALID_RESPONSE_MODEL",
                    endpointId,
                    path,
                    message: `Response ${response.statusCode} references a missing API model.`,
                });
            }
        }

        // 7. Validate request body model
        if (
            endpointRequestBody?.modelId &&
            !modelIds.has(String(endpointRequestBody.modelId))
        ) {
            errors.push({
                severity: "error",
                code: "INVALID_REQUEST_MODEL",
                endpointId,
                path,
                message: "Request body references a missing API model.",
            });
        }

        // 8. Validate security configuration
        if (!endpointSecurity) {
            errors.push({
                severity: "error",
                code: "MISSING_SECURITY",
                endpointId,
                path,
                message: `Endpoint ${method} ${path} has no security configuration.`,
            });
        }

        // 9. Advisory warning for body-capable methods
        if (
            ["POST", "PUT", "PATCH"].includes(method) &&
            !endpointRequestBody
        ) {
            warnings.push({
                severity: "warning",
                code: "MISSING_REQUEST_BODY",
                endpointId,
                path,
                message: `${method} endpoint has no request body configuration.`,
            });
        }
    }

    return {
        valid: errors.length === 0,
        summary: {
            endpointsChecked: endpoints.length,
            errors: errors.length,
            warnings: warnings.length,
        },
        errors,
        warnings,
    };
};