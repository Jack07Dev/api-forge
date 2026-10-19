import type { Request, Response } from "express";
import mongoose from "mongoose";

import {
    publishAPIVersion,
    publishValidatedAPIVersion
} from "../services/api-publishing.service.js";

export const validateForPublishing = async (
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

        // Validate required route parameters
        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "All resource IDs are required"
            });
            return;
        }

        // Validate MongoDB ObjectIds
        const ids = [
            organizationId,
            projectId,
            apiId,
            versionId
        ];

        if (!ids.every((id) => mongoose.isValidObjectId(id))) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        // Execute publishing validation
        const result = await publishAPIVersion({
            organizationId,
            projectId,
            apiId,
            versionId
        });

        if (!result.success) {
            res.status(422).json(result);
            return;
        }

        res.status(200).json(result);

    } catch (error: unknown) {
        console.error("Publishing validation error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Publishing validation failed";

        if (
            message === "API version not found" ||
            message === "API_VERSION_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "API version not found"
            });
            return;
        }

        if (
            message.startsWith("Cannot publish API version") ||
            message.includes("not available for publishing") ||
            message.includes("Publishing lock") ||
            message.includes("definition has changed")
        ) {
            res.status(409).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Publishing validation failed"
        });
    }
};

export const publish = async (
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
                message: "All resource IDs are required"
            });
            return;
        }

        const ids = [
            organizationId,
            projectId,
            apiId,
            versionId
        ];

        if (!ids.every((id) => mongoose.isValidObjectId(id))) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        const result = await publishValidatedAPIVersion({
            organizationId,
            projectId,
            apiId,
            versionId
        });

        if (!result.success) {
            res.status(422).json(result);
            return;
        }

        res.status(200).json(result);

    } catch (error: unknown) {
        console.error("API publishing error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "API publishing failed";

        // 404 - API version does not exist
        if (
            message === "API version not found" ||
            message === "API_VERSION_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "API version not found"
            });
            return;
        }

        // 409 - Invalid publishing state or lock conflict
        if (
            message.includes("not available for publishing") ||
            message.startsWith("Cannot publish API version") ||
            message.includes("Publishing lock") ||
            message.includes("definition has changed")
        ) {
            res.status(409).json({
                success: false,
                message
            });
            return;
        }

        // 500 - Unexpected server error
        res.status(500).json({
            success: false,
            message: "API publishing failed"
        });
    }
};