import type { Request, Response } from "express";

import { resolveActiveEndpoint } from "../resolvers/active-endpoint.resolver.js";
import type { HTTPMethod } from "../../models/APIEndpoint.js";

const ALLOWED_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
];

export const resolveActiveRuntime = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { organizationId, projectId, apiId } = req.params;
        const { method, path } = req.body ?? {};

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

        const result = await resolveActiveEndpoint({
            organizationId,
            projectId,
            apiId,
            method: method.toUpperCase() as HTTPMethod,
            path,
        });

        if (!result) {
            res.status(404).json({
                success: false,
                message: "Active API endpoint not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Active API endpoint resolved successfully",
            data: result,
        });
    } catch (error) {
        if (error instanceof Error) {
            if (
                [
                    "INVALID_API_IDENTIFIERS",
                    "INVALID_HTTP_METHOD",
                    "INVALID_ENDPOINT_PATH",
                    "INVALID_PATH_ENCODING",
                ].includes(error.message)
            ) {
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
                return;
            }
        }

        console.error("Active runtime resolver error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to resolve active API endpoint",
        });
    }
};