
import type { Request, Response } from "express";
import mongoose from "mongoose";

import type { HTTPMethod } from "../../models/APIEndpoint.js";

import { resolveActiveEndpoint } from "../resolvers/active-endpoint.resolver.js";
import { resolveDataSource } from "../resolvers/data-source.resolver.js";
import { resolveRequestValidation } from "../resolvers/request-validation.resolver.js";

import { validateRequestParameters } from "../validators/request-parameter.validator.js";

import {
    createDataRecord,
    findManyDataRecords,
    findOneDataRecord,
    updateDataRecord,
    deleteDataRecord,
    type DataRecordScope,
} from "../services/data-record.service.js";

const METHOD_OPERATIONS = {
    POST: ["create"],
    GET: ["findMany", "findOne"],
    PATCH: ["update"],
    DELETE: ["delete"],
} as const;

type SupportedMethod = keyof typeof METHOD_OPERATIONS;

const parseStringMap = (
    value: unknown,
    kind: "query" | "headers"
): Record<string, string> => {
    if (value === undefined) return Object.create(null);

    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        throw new Error(`INVALID_RUNTIME_${kind.toUpperCase()}`);
    }

    const entries = Object.entries(value);

    if (entries.length > 100) {
        throw new Error(`INVALID_RUNTIME_${kind.toUpperCase()}`);
    }

    const result: Record<string, string> = Object.create(null);

    for (const [key, item] of entries) {
        const validKey =
            kind === "query"
                ? /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
                : /^[a-zA-Z0-9-]+$/.test(key);

        if (
            !validKey ||
            typeof item !== "string" ||
            item.length > 4096 ||
            /[\r\n]/.test(item)
        ) {
            throw new Error(`INVALID_RUNTIME_${kind.toUpperCase()}`);
        }

        const normalizedKey =
            kind === "headers" ? key.toLowerCase() : key;

        if (Object.hasOwn(result, normalizedKey)) {
            throw new Error(`INVALID_RUNTIME_${kind.toUpperCase()}`);
        }

        result[normalizedKey] = item;
    }

    return result;
};

const parsePagination = (
    query: Record<string, string>
) => {
    const limit =
        query.limit === undefined ? 20 : Number(query.limit);

    const skip =
        query.skip === undefined ? 0 : Number(query.skip);

    if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isSafeInteger(skip) ||
        skip < 0 ||
        skip > 10000
    ) {
        throw new Error("RUNTIME_INVALID_PAGINATION");
    }

    return { limit, skip };
};

const requireRecordId = (
    params: Record<string, string>
): string => {
    const recordId = params.id;

    if (
        typeof recordId !== "string" ||
        !mongoose.isObjectIdOrHexString(recordId)
    ) {
        throw new Error("RUNTIME_INVALID_RECORD_ID");
    }

    return recordId;
};

export const executeDataRuntime = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { organizationId, projectId, apiId } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            ![organizationId, projectId, apiId].every(
                mongoose.isObjectIdOrHexString
            )
        ) {
            res.status(400).json({
                success: false,
                message: "INVALID_API_IDENTIFIERS",
            });
            return;
        }

        const input = req.body;

        if (
            !input ||
            typeof input !== "object" ||
            Array.isArray(input)
        ) {
            res.status(400).json({
                success: false,
                message: "INVALID_RUNTIME_REQUEST",
            });
            return;
        }

        const method =
            typeof input.method === "string"
                ? input.method.toUpperCase()
                : "";

        const path = input.path;

        if (
            !(method in METHOD_OPERATIONS) ||
            typeof path !== "string" ||
            !path.startsWith("/") ||
            path.includes("?") ||
            path.includes("#") ||
            path.includes("//")
        ) {
            res.status(400).json({
                success: false,
                message: "INVALID_RUNTIME_METHOD_OR_PATH",
            });
            return;
        }

        const query = parseStringMap(input.query, "query");
        const headers = parseStringMap(input.headers, "headers");

        const endpoint = await resolveActiveEndpoint({
            organizationId,
            projectId,
            apiId,
            method: method as HTTPMethod,
            path,
        });

        if (!endpoint) {
            res.status(404).json({
                success: false,
                message: "Active API endpoint not found",
            });
            return;
        }

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

        if (parameterErrors.length > 0) {
            res.status(400).json({
                success: false,
                message: "REQUEST_VALIDATION_FAILED",
                errors: parameterErrors,
            });
            return;
        }

        const resolved = await resolveDataSource({
            organizationId,
            projectId,
            apiId,
            apiVersionId: endpoint.versionId,
            endpointId: endpoint.endpointId,
        });

        if (!resolved) {
            res.status(404).json({
                success: false,
                message: "Active data source not configured",
            });
            return;
        }

        const { dataSource, model } = resolved;

        const allowedOperations =
            METHOD_OPERATIONS[method as SupportedMethod];

        if (
            !allowedOperations.some(
                (operation) => operation === dataSource.operation
            )
        ) {
            res.status(409).json({
                success: false,
                message: "RUNTIME_DATA_SOURCE_OPERATION_MISMATCH",
            });
            return;
        }

        const scope: DataRecordScope = {
            organizationId,
            projectId,
            apiId,
            apiVersionId: endpoint.versionId,
            modelId: String(model._id),
        };

        switch (dataSource.operation) {
            case "create": {
                const record = await createDataRecord({
                    scope,
                    fields: model.fields,
                    body: input.body,
                });

                res.status(201).json({
                    success: true,
                    data: record,
                });
                return;
            }

            case "findMany": {
                const { limit, skip } = parsePagination(query);

                const records = await findManyDataRecords({
                    scope,
                    limit,
                    skip,
                });

                res.status(200).json({
                    success: true,
                    data: records,
                });
                return;
            }

            case "findOne": {
                const recordId = requireRecordId(endpoint.params);

                const record = await findOneDataRecord({
                    scope,
                    recordId,
                });

                if (!record) {
                    res.status(404).json({
                        success: false,
                        message: "Record not found",
                    });
                    return;
                }

                res.status(200).json({
                    success: true,
                    data: record,
                });
                return;
            }

            case "update": {
                const recordId = requireRecordId(endpoint.params);

                const record = await updateDataRecord({
                    scope,
                    recordId,
                    fields: model.fields,
                    body: input.body,
                });

                if (!record) {
                    res.status(404).json({
                        success: false,
                        message: "Record not found",
                    });
                    return;
                }

                res.status(200).json({
                    success: true,
                    data: record,
                });
                return;
            }

            case "delete": {
                const recordId = requireRecordId(endpoint.params);

                const record = await deleteDataRecord({
                    scope,
                    recordId,
                });

                if (!record) {
                    res.status(404).json({
                        success: false,
                        message: "Record not found",
                    });
                    return;
                }

                res.status(200).json({
                    success: true,
                    message: "Record deleted successfully",
                    data: record,
                });
                return;
            }

            default:
                res.status(409).json({
                    success: false,
                    message: "Unsupported data source operation",
                });
                return;
        }
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "";

        const validationErrors = [
            "INVALID_API_IDENTIFIERS",
            "INVALID_HTTP_METHOD",
            "INVALID_ENDPOINT_PATH",
            "INVALID_PATH_ENCODING",
            "INVALID_RUNTIME_QUERY",
            "INVALID_RUNTIME_HEADERS",
            "RUNTIME_INVALID_RECORD_SCOPE",
            "RUNTIME_INVALID_RECORD_ID",
            "RUNTIME_INVALID_RECORD_BODY",
            "RUNTIME_EMPTY_RECORD_UPDATE",
            "RUNTIME_UNKNOWN_RECORD_FIELD",
            "RUNTIME_UNSAFE_MODEL_FIELD",
            "RUNTIME_DUPLICATE_MODEL_FIELD",
            "RUNTIME_RECORD_VALIDATION_FAILED",
            "RUNTIME_INVALID_PAGINATION",
            "RUNTIME_INVALID_RECORD_LIMIT",
            "RUNTIME_INVALID_RECORD_SKIP",
            "RUNTIME_INVALID_DATA_SOURCE_SCOPE",
        ];

        if (validationErrors.includes(message)) {
            res.status(400).json({
                success: false,
                message,
                ...(
                    error instanceof Error &&
                        "validationErrors" in error
                        ? { errors: error.validationErrors }
                        : {}
                ),
            });
            return;
        }

        if (message === "RUNTIME_DATA_SOURCE_MODEL_NOT_FOUND") {
            res.status(409).json({
                success: false,
                message,
            });
            return;
        }

        console.error("Data runtime execution error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to execute database API endpoint",
        });
    }
};
