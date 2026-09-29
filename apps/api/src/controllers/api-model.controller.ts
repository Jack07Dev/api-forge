import { Response } from "express";
import mongoose from "mongoose";

import {
    createAPIModel,
    getAPIModels,
    getAPIModelById,
    updateAPIModel,
    archiveAPIModel
} from "../services/api-model.service.js";

import {
    AuthenticatedRequest
} from "../middlewares/auth.middleware.js";

export const create = async (
    req: AuthenticatedRequest,
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
            typeof projectId !== "string" ||
            !mongoose.Types.ObjectId.isValid(projectId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
            return;
        }

        if (
            typeof apiId !== "string" ||
            !mongoose.Types.ObjectId.isValid(apiId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API ID"
            });
            return;
        }

        if (
            typeof versionId !== "string" ||
            !mongoose.Types.ObjectId.isValid(versionId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid version ID"
            });
            return;
        }

        if (!req.user) {
            res.status(401).json({
                success: false,
                message: "Authentication required"
            });
            return;
        }

        const {
            name,
            description,
            fields
        } = req.body;

        if (
            typeof name !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Model name is required"
            });
            return;
        }

        const model =
            await createAPIModel({
                name,
                description,
                fields,
                apiId,
                versionId,
                projectId,
                organizationId:
                    req.organization!.id,
                userId:
                    req.user.userId
            });

        res.status(201).json({
            success: true,
            message:
                "API model created successfully",
            data: model
        });
    } catch (error) {
        console.error(
            "Create API model error:",
            error
        );

        res.status(400).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to create API model"
        });
    }
};

export const list = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const {
            projectId,
            apiId,
            versionId
        } = req.params;

        if (
            typeof projectId !== "string" ||
            !mongoose.Types.ObjectId.isValid(projectId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
            return;
        }

        if (
            typeof apiId !== "string" ||
            !mongoose.Types.ObjectId.isValid(apiId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API ID"
            });
            return;
        }

        if (
            typeof versionId !== "string" ||
            !mongoose.Types.ObjectId.isValid(versionId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid version ID"
            });
            return;
        }

        const models = await getAPIModels(
            apiId,
            versionId,
            projectId,
            req.organization!.id
        );

        res.status(200).json({
            success: true,
            data: models
        });
    } catch (error) {
        console.error(
            "Get API models error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to get API models"
        });
    }
};

export const getById = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const {
            projectId,
            apiId,
            versionId,
            modelId
        } = req.params;

        if (
            typeof projectId !== "string" ||
            !mongoose.Types.ObjectId.isValid(projectId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
            return;
        }

        if (
            typeof apiId !== "string" ||
            !mongoose.Types.ObjectId.isValid(apiId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API ID"
            });
            return;
        }

        if (
            typeof versionId !== "string" ||
            !mongoose.Types.ObjectId.isValid(versionId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid version ID"
            });
            return;
        }

        if (
            typeof modelId !== "string" ||
            !mongoose.Types.ObjectId.isValid(modelId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid model ID"
            });
            return;
        }

        const model = await getAPIModelById(
            modelId,
            apiId,
            versionId,
            projectId,
            req.organization!.id
        );

        if (!model) {
            res.status(404).json({
                success: false,
                message: "API model not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: model
        });
    } catch (error) {
        console.error(
            "Get API model error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to get API model"
        });
    }
};

export const update = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const {
            projectId,
            apiId,
            versionId,
            modelId
        } = req.params;

        if (
            typeof projectId !== "string" ||
            !mongoose.Types.ObjectId.isValid(projectId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
            return;
        }

        if (
            typeof apiId !== "string" ||
            !mongoose.Types.ObjectId.isValid(apiId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API ID"
            });
            return;
        }

        if (
            typeof versionId !== "string" ||
            !mongoose.Types.ObjectId.isValid(versionId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid version ID"
            });
            return;
        }

        if (
            typeof modelId !== "string" ||
            !mongoose.Types.ObjectId.isValid(modelId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid model ID"
            });
            return;
        }

        const {
            name,
            description,
            fields
        } = req.body;

        const model =
            await updateAPIModel({
                modelId,
                apiId,
                versionId,
                projectId,
                organizationId:
                    req.organization!.id,
                name,
                description,
                fields
            });

        res.status(200).json({
            success: true,
            message:
                "API model updated successfully",
            data: model
        });
    } catch (error) {
        console.error(
            "Update API model error:",
            error
        );

        res.status(400).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to update API model"
        });
    }
};

export const archive = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const {
            projectId,
            apiId,
            versionId,
            modelId
        } = req.params;

        if (
            typeof projectId !== "string" ||
            !mongoose.Types.ObjectId.isValid(projectId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
            return;
        }

        if (
            typeof apiId !== "string" ||
            !mongoose.Types.ObjectId.isValid(apiId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API ID"
            });
            return;
        }

        if (
            typeof versionId !== "string" ||
            !mongoose.Types.ObjectId.isValid(versionId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid version ID"
            });
            return;
        }

        if (
            typeof modelId !== "string" ||
            !mongoose.Types.ObjectId.isValid(modelId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid model ID"
            });
            return;
        }

        const model =
            await archiveAPIModel(
                modelId,
                apiId,
                versionId,
                projectId,
                req.organization!.id
            );

        res.status(200).json({
            success: true,
            message:
                "API model archived successfully",
            data: model
        });
    } catch (error) {
        console.error(
            "Archive API model error:",
            error
        );

        res.status(400).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to archive API model"
        });
    }
};