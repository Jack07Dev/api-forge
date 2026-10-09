import type { Request, Response } from "express";
import { generateOpenAPISpec } from "../services/openapi-generator.service.js";

export const getOpenAPISpec = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { organizationId, projectId, apiId, versionId } = req.params;

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

        const spec = await generateOpenAPISpec({
            organizationId,
            projectId,
            apiId,
            versionId
        });

        res.status(200).json(spec);
    } catch (error) {
        console.error("OpenAPI generation error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Failed to generate OpenAPI specification";

        res.status(500).json({
            success: false,
            message
        });
    }
};
 