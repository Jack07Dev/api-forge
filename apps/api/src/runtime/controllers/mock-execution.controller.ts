import type { Request, Response } from "express";

import { renderMockTemplate } from "../utils/mock-template.renderer.js";
import { resolveActiveEndpoint } from "../resolvers/active-endpoint.resolver.js";
import { resolveMockResponse } from "../resolvers/mock-response.resolver.js";
import { resolveRequestValidation } from "../resolvers/request-validation.resolver.js";

import { validateRequestParameters } from "../validators/request-parameter.validator.js";
import { validateRequestBody } from "../validators/request-body.validator.js";

import type { HTTPMethod } from "../../models/APIEndpoint.js";

const ALLOWED_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
];

const parseQuery = (value: unknown): Record<string, string> => {
    if (value === undefined) return {};

    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        throw new Error("INVALID_RUNTIME_QUERY");
    }

    const entries = Object.entries(value);

    if (entries.length > 100) {
        throw new Error("INVALID_RUNTIME_QUERY");
    }

    const query: Record<string, string> = Object.create(null);

    for (const [key, item] of entries) {
        if (
            !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ||
            typeof item !== "string" ||
            item.length > 4096
        ) {
            throw new Error("INVALID_RUNTIME_QUERY");
        }

        query[key] = item;
    }

    return query;
};

const parseHeaders = (
    value: unknown
): Record<string, string> => {
    if (value === undefined) return {};

    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        throw new Error("INVALID_RUNTIME_HEADERS");
    }

    const entries = Object.entries(value);

    if (entries.length > 100) {
        throw new Error("INVALID_RUNTIME_HEADERS");
    }

    const headers: Record<string, string> = Object.create(null);

    for (const [key, item] of entries) {
        if (
            !/^[a-zA-Z0-9-]+$/.test(key) ||
            typeof item !== "string" ||
            item.length > 4096 ||
            /[\r\n]/.test(item)
        ) {
            throw new Error("INVALID_RUNTIME_HEADERS");
        }

        const normalizedKey = key.toLowerCase();

        if (Object.hasOwn(headers, normalizedKey)) {
            throw new Error("INVALID_RUNTIME_HEADERS");
        }

        headers[normalizedKey] = item;
    }

    return headers;
};

export const executeMockRuntime = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { organizationId, projectId, apiId } = req.params;

        const { method, path } = req.body ?? {};

        const query = parseQuery(req.body?.query);
        const headers = parseHeaders(req.body?.headers);
        const requestBody = req.body?.body;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API identifiers",
            });
            return;
        }

        if (
            typeof method !== "string" ||
            !ALLOWED_METHODS.includes(method.toUpperCase()) ||
            typeof path !== "string" ||
            !path.startsWith("/") ||
            path.includes("?") ||
            path.includes("#") ||
            path.includes("//")
        ) {
            res.status(400).json({
                success: false,
                message: "Valid HTTP method and path are required",
            });
            return;
        }

        // Resolve only the active published endpoint.
        const endpoint = await resolveActiveEndpoint({
            organizationId,
            projectId,
            apiId,
            method: method.toUpperCase() as HTTPMethod,
            path,
        });

        if (!endpoint) {
            res.status(404).json({
                success: false,
                message: "Active API endpoint not found",
            });
            return;
        }

        // Load validation configuration for this exact endpoint/version.
        const validation = await resolveRequestValidation({
            organizationId,
            projectId,
            apiId,
            apiVersionId: endpoint.versionId,
            endpointId: endpoint.endpointId,
        });

        const parameterErrors = validateRequestParameters({
            rules: validation.parameters,
            params: endpoint.params,
            query,
            headers,
        });

        const bodyErrors = validation.requestBody
            ? validateRequestBody({
                body: requestBody,
                required: validation.requestBody.required,
                fields: validation.fields,
            })
            : [];

        if (parameterErrors.length > 0 || bodyErrors.length > 0) {
            res.status(400).json({
                success: false,
                message: "REQUEST_VALIDATION_FAILED",
                errors: [
                    ...parameterErrors,
                    ...bodyErrors.map((error) => ({
                        location: "body",
                        ...error,
                    })),
                ],
            });
            return;
        }

        // Resolve mock only after successful validation.
        const mockResponse = await resolveMockResponse({
            organizationId,
            projectId,
            apiId,
            apiVersionId: endpoint.versionId,
            endpointId: endpoint.endpointId,
        });

        if (!mockResponse) {
            res.status(404).json({
                success: false,
                message: "Mock response not configured",
            });
            return;
        }

        const renderedBody = renderMockTemplate(
            mockResponse.responseBody,
            {
                params: endpoint.params,
                query,
            }
        );

        res.status(mockResponse.statusCode).json(renderedBody);
    } catch (error) {
        if (error instanceof Error) {
            if (
                [
                    "INVALID_API_IDENTIFIERS",
                    "INVALID_HTTP_METHOD",
                    "INVALID_ENDPOINT_PATH",
                    "INVALID_PATH_ENCODING",
                    "INVALID_MOCK_RESPONSE_IDENTIFIERS",
                    "INVALID_RUNTIME_QUERY",
                    "INVALID_RUNTIME_HEADERS",
                ].includes(error.message)
            ) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }

        console.error("Mock runtime execution error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to execute mock API endpoint",
        });
    }
};