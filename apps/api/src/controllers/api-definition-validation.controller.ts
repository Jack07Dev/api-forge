import type { Response } from "express";
import mongoose from "mongoose";

import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

import {
    validateAPIVersionDefinition,
} from "../services/api-definition-validation.service.js";

export const validate = async (
    req: AuthenticatedRequest,
    res: Response,
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        const {
            organizationId,
            projectId,
            apiId,
            versionId,
        } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid or missing resource ID",
            });
            return;
        }

        const result = await validateAPIVersionDefinition({
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId,
        });

        res.status(200).json({
            success: true,
            message: "API version validation completed",
            data: result,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "API_VERSION_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "API version not found",
            });
            return;
        }

        console.error("API definition validation error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to validate API version definition",
        });
    }
};