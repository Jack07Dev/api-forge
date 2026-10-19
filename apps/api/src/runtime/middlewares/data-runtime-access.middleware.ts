
import type { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Project from "../../models/Project.js";
import API from "../../models/API.js";

import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

export const requireDataRuntimeAccess = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
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
                message: "Invalid runtime identifiers",
            });
            return;
        }

        const project = await Project.findOne({
            _id: projectId,
            organizationId,
            status: "active",
        }).lean();

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Active project not found",
            });
            return;
        }

        const api = await API.findOne({
            _id: apiId,
            organizationId,
            projectId,
            status: "active",
        }).lean();

        if (!api) {
            res.status(404).json({
                success: false,
                message: "Active API not found",
            });
            return;
        }

        next();
    } catch (error) {
        console.error("Data runtime access error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to verify runtime access",
        });
    }
};
