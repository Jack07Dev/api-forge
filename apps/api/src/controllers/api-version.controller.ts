import { Response } from "express";
import mongoose from "mongoose";

import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { createAPIVersion, getAPIVersions, getAPIVersionById, updateAPIVersionStatus, updateAPIVersion } from "../services/api-version.service.js";

export const create = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.user || !req.organization) {
            res.status(401).json({
                success: false,
                message: "Authentication required"
            });
            return;
        }

        const { projectId, apiId } = req.params;

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

        const apiVersion = await createAPIVersion({
            apiId,
            projectId,
            organizationId: req.organization.id,
            userId: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: "API version created successfully",
            data: apiVersion
        });
    } catch (error) {
        console.error(
            "Create API version error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to create API version";

        res.status(400).json({
            success: false,
            message
        });
    }
};

export const list = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.user || !req.organization) {
            res.status(401).json({
                success: false,
                message: "Authentication required"
            });
            return;
        }

        const { projectId, apiId } = req.params;

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

        const versions = await getAPIVersions(
            apiId,
            projectId,
            req.organization.id
        );

        res.status(200).json({
            success: true,
            data: versions
        });
    } catch (error) {
        console.error(
            "List API versions error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch API versions"
        });
    }
};

export const getById = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.user || !req.organization) {
            res.status(401).json({
                success: false,
                message: "Authentication required"
            });
            return;
        }

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

        const version = await getAPIVersionById(
            versionId,
            apiId,
            projectId,
            req.organization.id
        );

        if (!version) {
            res.status(404).json({
                success: false,
                message: "API version not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: version
        });
    } catch (error) {
        console.error(
            "Get API version error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch API version"
        });
    }
};

export const updateStatus = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.user || !req.organization) {
            res.status(401).json({
                success: false,
                message: "Authentication required"
            });
            return;
        }

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

        const { status } = req.body;

        const allowedStatuses = [
            "draft",
            "active",
            "deprecated",
            "archived"
        ];

        if (
            typeof status !== "string" ||
            !allowedStatuses.includes(status)
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Invalid status. Allowed values: draft, active, deprecated, archived"
            });
            return;
        }

        const updatedVersion =
            await updateAPIVersionStatus({
                versionId,
                apiId,
                projectId,
                organizationId: req.organization.id,
                status: status as
                    | "draft"
                    | "active"
                    | "deprecated"
                    | "archived"
            });

        res.status(200).json({
            success: true,
            message:
                "API version status updated successfully",
            data: updatedVersion
        });
    } catch (error) {
        console.error(
            "Update API version status error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to update API version status";

        const statusCode =
            message === "API version not found"
                ? 404
                : 400;

        res.status(statusCode).json({
            success: false,
            message
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

    const { basePath, description } = req.body;

    const apiVersion = await updateAPIVersion({
      versionId,
      apiId,
      projectId,
      organizationId:
        req.organization!.id,
      basePath,
      description
    });

    res.status(200).json({
      success: true,
      message:
        "API version updated successfully",
      data: apiVersion
    });
  } catch (error) {
    console.error(
      "Update API version error:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update API version"
    });
  }
};