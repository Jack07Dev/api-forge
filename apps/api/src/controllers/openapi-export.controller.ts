import type { Request, Response } from "express";
import YAML from "yaml";

import { generateOpenAPISpec } from "../services/openapi-generator.service.js";

export const exportOpenAPI = async (
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

        const format = req.query.format ?? "json";

        if (format !== "json" && format !== "yaml") {
            res.status(400).json({
                success: false,
                message: "Format must be json or yaml"
            });
            return;
        }

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

        const specification = await generateOpenAPISpec({
            organizationId,
            projectId,
            apiId,
            versionId
        });

        if (format === "yaml") {
            res.setHeader("Content-Type", "application/yaml; charset=utf-8");
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="openapi.yaml"'
            );

            res.status(200).send(YAML.stringify(specification));
            return;
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="openapi.json"'
        );

        res.status(200).send(JSON.stringify(specification, null, 2));
    } catch (error) {
        console.error("OpenAPI export error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to export OpenAPI specification"
        });
    }
};