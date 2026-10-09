import type { Request, Response } from "express";

import { generateOpenAPISpec } from "../services/openapi-generator.service.js";
import { validateOpenAPISpec } from "../services/openapi-validation.service.js";

export const validateOpenAPI = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const {
            organizationId,
            projectId,
            apiId,
            versionId
        } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid route parameters"
            });
            return;
        }

        // Step 1: Generate OpenAPI JSON from MongoDB
        const specification = await generateOpenAPISpec({
            organizationId,
            projectId,
            apiId,
            versionId
        });

        // Step 2: Validate the generated specification
        const result = await validateOpenAPISpec(specification);

        res.status(200).json({
            success: true,
            message: "OpenAPI validation completed",
            data: result
        });
    } catch (error) {
        console.error("OpenAPI validation error:", error);

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to validate OpenAPI specification"
        });
    }
};