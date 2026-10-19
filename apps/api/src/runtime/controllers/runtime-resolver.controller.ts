import type { Request, Response } from "express";
import { resolveEndpoint } from "../resolvers/endpoint.resolver.js";

export const testResolveEndpoint = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { organizationId, projectId, apiId, versionId } = req.params;
        const { method, path } = req.body ?? {};

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API identifiers"
            });
            return;
        }

        if (
            typeof method !== "string" ||
            !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()) ||
            typeof path !== "string" ||
            !path.startsWith("/") ||
            path.includes("?")
        ) {
            res.status(400).json({
                success: false,
                message: "Valid HTTP method and path are required"
            });
            return;
        }

        const result = await resolveEndpoint({
            organizationId,
            projectId,
            apiId,
            versionId,
            method,
            path
        });

        if (!result) {
            res.status(404).json({
                success: false,
                message: "Matching API endpoint not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "API endpoint resolved successfully",
            data: result
        });
    } catch (error) {
        console.error("Runtime resolver error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to resolve API endpoint"
        });
    }
};