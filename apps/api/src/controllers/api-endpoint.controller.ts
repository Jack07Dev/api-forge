import { Response } from "express";
import mongoose from "mongoose";

import {
    createAPIEndpoint,
    getAPIEndpoints,
    getAPIEndpointById,
    updateAPIEndpoint,
    archiveAPIEndpoint
} from "../services/api-endpoint.service.js";

import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

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
                message:
                    "Organization ID, project ID, API ID and version ID are required"
            });
            return;
        }

        if (
            !mongoose.Types.ObjectId.isValid(
                organizationId
            ) ||
            !mongoose.Types.ObjectId.isValid(
                projectId
            ) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(
                versionId
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        const {
            name,
            description,
            method,
            path
        } = req.body;

        if (!name) {
            res.status(400).json({
                success: false,
                message: "Endpoint name is required"
            });
            return;
        }

        if (!method) {
            res.status(400).json({
                success: false,
                message: "HTTP method is required"
            });
            return;
        }

        if (!path) {
            res.status(400).json({
                success: false,
                message: "Endpoint path is required"
            });
            return;
        }

        const endpoint =
            await createAPIEndpoint({
                name,
                description,
                method,
                path,
                apiId,
                apiVersionId: versionId,
                projectId,
                organizationId,
                userId: req.user.userId
            });

        res.status(201).json({
            success: true,
            message:
                "API endpoint created successfully",
            data: {
                id: endpoint._id,
                apiId: endpoint.apiId,
                apiVersionId:
                    endpoint.apiVersionId,
                name: endpoint.name,
                description:
                    endpoint.description,
                method: endpoint.method,
                path: endpoint.path,
                status: endpoint.status,
                createdBy:
                    endpoint.createdBy,
                createdAt:
                    endpoint.createdAt,
                updatedAt:
                    endpoint.updatedAt
            }
        });
    } catch (error) {
        console.error(
            "Create API endpoint error:",
            error
        );

        res.status(400).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to create API endpoint"
        });
    }
};

export const list = async (
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
                message:
                    "Organization ID, project ID, API ID and version ID are required"
            });
            return;
        }

        if (
            !mongoose.Types.ObjectId.isValid(
                organizationId
            ) ||
            !mongoose.Types.ObjectId.isValid(
                projectId
            ) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(
                versionId
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        const endpoints =
            await getAPIEndpoints(
                apiId,
                versionId,
                projectId,
                organizationId
            );

        res.status(200).json({
            success: true,
            data: endpoints
        });
    } catch (error) {
        console.error(
            "Get API endpoints error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to get API endpoints"
        });
    }
};

export const getById = async (
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

        const {
            organizationId,
            projectId,
            apiId,
            versionId,
            endpointId
        } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Organization ID, project ID, API ID, version ID and endpoint ID are required"
            });
            return;
        }

        if (
            !mongoose.Types.ObjectId.isValid(
                organizationId
            ) ||
            !mongoose.Types.ObjectId.isValid(
                projectId
            ) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(
                versionId
            ) ||
            !mongoose.Types.ObjectId.isValid(
                endpointId
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        const endpoint =
            await getAPIEndpointById(
                endpointId,
                apiId,
                versionId,
                projectId,
                organizationId
            );

        if (!endpoint) {
            res.status(404).json({
                success: false,
                message: "API endpoint not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                id: endpoint._id,
                apiId: endpoint.apiId,
                apiVersionId:
                    endpoint.apiVersionId,
                projectId:
                    endpoint.projectId,
                organizationId:
                    endpoint.organizationId,
                name: endpoint.name,
                description:
                    endpoint.description,
                method: endpoint.method,
                path: endpoint.path,
                status: endpoint.status,
                createdBy:
                    endpoint.createdBy,
                createdAt:
                    endpoint.createdAt,
                updatedAt:
                    endpoint.updatedAt
            }
        });
    } catch (error) {
        console.error(
            "Get API endpoint error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to get API endpoint"
        });
    }
};

export const update = async (
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

        const {
            organizationId,
            projectId,
            apiId,
            versionId,
            endpointId
        } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Organization ID, project ID, API ID, version ID and endpoint ID are required"
            });
            return;
        }

        if (
            !mongoose.Types.ObjectId.isValid(
                organizationId
            ) ||
            !mongoose.Types.ObjectId.isValid(
                projectId
            ) ||
            !mongoose.Types.ObjectId.isValid(
                apiId
            ) ||
            !mongoose.Types.ObjectId.isValid(
                versionId
            ) ||
            !mongoose.Types.ObjectId.isValid(
                endpointId
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        const {
            name,
            description,
            method,
            path
        } = req.body;

        if (
            name === undefined &&
            description === undefined &&
            method === undefined &&
            path === undefined
        ) {
            res.status(400).json({
                success: false,
                message:
                    "At least one field is required to update"
            });
            return;
        }

        const endpoint =
            await updateAPIEndpoint({
                endpointId,
                apiId,
                apiVersionId: versionId,
                projectId,
                organizationId,
                name,
                description,
                method,
                path
            });

        if (!endpoint) {
            res.status(404).json({
                success: false,
                message: "API endpoint not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            message:
                "API endpoint updated successfully",
            data: {
                id: endpoint._id,
                apiId: endpoint.apiId,
                apiVersionId:
                    endpoint.apiVersionId,
                projectId:
                    endpoint.projectId,
                organizationId:
                    endpoint.organizationId,
                name: endpoint.name,
                description:
                    endpoint.description,
                method: endpoint.method,
                path: endpoint.path,
                status: endpoint.status,
                createdBy:
                    endpoint.createdBy,
                createdAt:
                    endpoint.createdAt,
                updatedAt:
                    endpoint.updatedAt
            }
        });
    } catch (error) {
        console.error(
            "Update API endpoint error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to update API endpoint";

        if (
            message.includes(
                "cannot be"
            ) ||
            message.includes(
                "Invalid HTTP method"
            ) ||
            message.includes(
                "Invalid"
            ) ||
            message.includes(
                "already exists"
            ) ||
            message.includes(
                "API endpoint not found"
            )
        ) {
            const statusCode =
                message === "API endpoint not found"
                    ? 404
                    : 400;

            res.status(statusCode).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message:
                "Failed to update API endpoint"
        });
    }
};

export const archive = async (
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

    const {
      organizationId,
      projectId,
      apiId,
      versionId,
      endpointId
    } = req.params;

    if (
      typeof organizationId !== "string" ||
      typeof projectId !== "string" ||
      typeof apiId !== "string" ||
      typeof versionId !== "string" ||
      typeof endpointId !== "string"
    ) {
      res.status(400).json({
        success: false,
        message:
          "Organization ID, project ID, API ID, version ID and endpoint ID are required"
      });
      return;
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        organizationId
      ) ||
      !mongoose.Types.ObjectId.isValid(
        projectId
      ) ||
      !mongoose.Types.ObjectId.isValid(
        apiId
      ) ||
      !mongoose.Types.ObjectId.isValid(
        versionId
      ) ||
      !mongoose.Types.ObjectId.isValid(
        endpointId
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid resource ID"
      });
      return;
    }

    const endpoint =
      await archiveAPIEndpoint(
        endpointId,
        apiId,
        versionId,
        projectId,
        organizationId
      );

    if (!endpoint) {
      res.status(404).json({
        success: false,
        message:
          "API endpoint not found or already archived"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message:
        "API endpoint archived successfully",
      data: {
        id: endpoint._id,
        apiId: endpoint.apiId,
        apiVersionId:
          endpoint.apiVersionId,
        projectId:
          endpoint.projectId,
        organizationId:
          endpoint.organizationId,
        name: endpoint.name,
        description:
          endpoint.description,
        method: endpoint.method,
        path: endpoint.path,
        status: endpoint.status,
        createdBy:
          endpoint.createdBy,
        createdAt:
          endpoint.createdAt,
        updatedAt:
          endpoint.updatedAt
      }
    });
  } catch (error) {
    console.error(
      "Archive API endpoint error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to archive API endpoint"
    });
  }
};