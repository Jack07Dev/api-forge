import { Response } from "express";
import mongoose from "mongoose";

import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { createAPI, getProjectAPIs, getAPIById, updateAPI, archiveAPI } from "../services/api.service.js";

export const create = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: "Authentication required"
            });
            return;
        }

        if (!req.organization) {
            res.status(403).json({
                success: false,
                message: "Organization access required"
            });
            return;
        }

        const { projectId } = req.params;

        if (
            !projectId ||
            typeof projectId !== "string" ||
            !mongoose.Types.ObjectId.isValid(projectId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
            return;
        }

        const { name, description } = req.body;

        if (!name) {
            res.status(400).json({
                success: false,
                message: "API name is required"
            });
            return;
        }

        if (typeof name !== "string") {
            res.status(400).json({
                success: false,
                message: "API name must be a string"
            });
            return;
        }

        if (
            description !== undefined &&
            typeof description !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "API description must be a string"
            });
            return;
        }

        const api = await createAPI({
            name,
            description,
            projectId,
            organizationId: req.organization.id,
            userId: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: "API created successfully",
            data: {
                id: api._id,
                name: api.name,
                slug: api.slug,
                description: api.description,
                projectId: api.projectId,
                organizationId: api.organizationId,
                status: api.status,
                createdBy: api.createdBy,
                createdAt: api.createdAt,
                updatedAt: api.updatedAt
            }
        });
    } catch (error) {
        console.error("Create API error:", error);

        res.status(400).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to create API"
        });
    }
};

export const list = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.organization) {
            res.status(403).json({
                success: false,
                message: "Organization access required"
            });
            return;
        }

        const { projectId } = req.params;

        if (
            !projectId ||
            typeof projectId !== "string" ||
            !mongoose.Types.ObjectId.isValid(projectId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
            return;
        }

        const apis = await getProjectAPIs(
            projectId,
            req.organization.id
        );

        res.status(200).json({
            success: true,
            data: apis
        });
    } catch (error) {
        console.error("Get project APIs error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get project APIs"
        });
    }
};

export const getById = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.organization) {
            res.status(403).json({
                success: false,
                message: "Organization access required"
            });
            return;
        }

        const { projectId, apiId } = req.params;

        if (
            !projectId ||
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
            !apiId ||
            typeof apiId !== "string" ||
            !mongoose.Types.ObjectId.isValid(apiId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API ID"
            });
            return;
        }

        const api = await getAPIById(
            apiId,
            projectId,
            req.organization.id
        );

        if (!api) {
            res.status(404).json({
                success: false,
                message: "API not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: api
        });
    } catch (error) {
        console.error("Get API error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get API"
        });
    }
};

export const update = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.organization) {
            res.status(403).json({
                success: false,
                message: "Organization access required"
            });
            return;
        }

        const { projectId, apiId } = req.params;

        if (
            !projectId ||
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
            !apiId ||
            typeof apiId !== "string" ||
            !mongoose.Types.ObjectId.isValid(apiId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API ID"
            });
            return;
        }

        const { name, description } = req.body;

        if (
            name === undefined &&
            description === undefined
        ) {
            res.status(400).json({
                success: false,
                message: "No fields provided for update"
            });
            return;
        }

        if (
            name !== undefined &&
            typeof name !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "API name must be a string"
            });
            return;
        }

        if (
            description !== undefined &&
            typeof description !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "API description must be a string"
            });
            return;
        }

        const api = await updateAPI({
            apiId,
            projectId,
            organizationId: req.organization.id,
            name,
            description
        });

        if (!api) {
            res.status(404).json({
                success: false,
                message: "API not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "API updated successfully",
            data: api
        });
    } catch (error) {
        console.error("Update API error:", error);

        res.status(400).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to update API"
        });
    }
};

export const archive = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.organization) {
            res.status(403).json({
                success: false,
                message: "Organization access required"
            });
            return;
        }

        const { projectId, apiId } = req.params;

        if (
            !projectId ||
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
            !apiId ||
            typeof apiId !== "string" ||
            !mongoose.Types.ObjectId.isValid(apiId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid API ID"
            });
            return;
        }

        const api = await archiveAPI(
            apiId,
            projectId,
            req.organization.id
        );

        if (!api) {
            res.status(404).json({
                success: false,
                message: "API not found or already archived"
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "API archived successfully",
            data: api
        });
    } catch (error) {
        console.error("Archive API error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to archive API"
        });
    }
};