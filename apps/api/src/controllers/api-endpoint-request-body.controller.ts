
import { Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
    createEndpointRequestBody,
    getEndpointRequestBody,
    updateEndpointRequestBody,
    deleteEndpointRequestBody
} from "../services/api-endpoint-request-body.service.js";

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
            versionId,
            endpointId
        } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string" ||
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid or missing resource ID"
            });
            return;
        }

        const { modelId, contentType, required } = req.body;

        if (typeof modelId !== "string" || !modelId.trim()) {
            res.status(400).json({
                success: false,
                message: "modelId is required"
            });
            return;
        }

        if (typeof contentType !== "string") {
            res.status(400).json({
                success: false,
                message: "contentType is required"
            });
            return;
        }

        if (
            required !== undefined &&
            typeof required !== "boolean"
        ) {
            res.status(400).json({
                success: false,
                message: "required must be a boolean"
            });
            return;
        }

        const requestBody = await createEndpointRequestBody({
            endpointId,
            apiId,
            apiVersionId: versionId,
            projectId,
            organizationId,
            modelId,
            contentType,
            required,
            userId: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: "Endpoint request body created successfully",
            data: requestBody
        });
    } catch (error) {
        console.error("Create request body error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Failed to create request body";

        if (
            message === "API endpoint not found" ||
            message === "API model not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        if (
            message.includes("already exists") ||
            message.includes("only supported") ||
            message.includes("Unsupported") ||
            message.includes("Invalid")
        ) {
            res.status(400).json({
                success: false,
                message
            });
            return;
        }

        if (
            error instanceof Error &&
            error.name === "MongoServerError" &&
            "code" in error &&
            error.code === 11000
        ) {
            res.status(409).json({
                success: false,
                message: "Request body configuration already exists"
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to create endpoint request body"
        });
    }
};

export const getByEndpoint = async (
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
            typeof endpointId !== "string" ||
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid or missing resource ID"
            });
            return;
        }

        const requestBody = await getEndpointRequestBody({
            endpointId,
            apiId,
            apiVersionId: versionId,
            projectId,
            organizationId
        });

        res.status(200).json({
            success: true,
            message: "Endpoint request body fetched successfully",
            data: requestBody
        });
    } catch (error) {
        console.error("Get endpoint request body error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Failed to fetch endpoint request body";

        if (
            message === "API endpoint not found" ||
            message === "Endpoint request body not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to fetch endpoint request body"
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
            typeof endpointId !== "string" ||
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid or missing resource ID"
            });
            return;
        }

        const { modelId, contentType, required } = req.body ?? {};

        if (
            modelId === undefined &&
            contentType === undefined &&
            required === undefined
        ) {
            res.status(400).json({
                success: false,
                message: "At least one field is required"
            });
            return;
        }

        if (
            modelId !== undefined &&
            (typeof modelId !== "string" || !modelId.trim())
        ) {
            res.status(400).json({
                success: false,
                message: "modelId must be a valid string"
            });
            return;
        }

        if (
            contentType !== undefined &&
            typeof contentType !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "contentType must be a string"
            });
            return;
        }

        if (
            required !== undefined &&
            typeof required !== "boolean"
        ) {
            res.status(400).json({
                success: false,
                message: "required must be a boolean"
            });
            return;
        }

        const requestBody = await updateEndpointRequestBody({
            endpointId,
            apiId,
            apiVersionId: versionId,
            projectId,
            organizationId,
            modelId,
            contentType,
            required
        });

        res.status(200).json({
            success: true,
            message: "Endpoint request body updated successfully",
            data: requestBody
        });
    } catch (error) {
        console.error("Update endpoint request body error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Failed to update endpoint request body";

        if (
            message === "API endpoint not found" ||
            message === "Endpoint request body not found" ||
            message === "API model not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        if (
            message === "Unsupported content type" ||
            message === "Invalid model ID"
        ) {
            res.status(400).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to update endpoint request body"
        });
    }
};


export const remove = async (
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
      typeof endpointId !== "string" ||
      !mongoose.Types.ObjectId.isValid(organizationId) ||
      !mongoose.Types.ObjectId.isValid(projectId) ||
      !mongoose.Types.ObjectId.isValid(apiId) ||
      !mongoose.Types.ObjectId.isValid(versionId) ||
      !mongoose.Types.ObjectId.isValid(endpointId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid or missing resource ID"
      });
      return;
    }

    const deleted = await deleteEndpointRequestBody({
      endpointId,
      apiId,
      apiVersionId: versionId,
      projectId,
      organizationId
    });

    res.status(200).json({
      success: true,
      message: "Endpoint request body deleted successfully",
      data: {
        id: deleted._id,
        endpointId: deleted.endpointId
      }
    });
  } catch (error) {
    console.error("Delete endpoint request body error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete endpoint request body";

    if (
      message === "API endpoint not found" ||
      message === "Endpoint request body not found"
    ) {
      res.status(404).json({
        success: false,
        message
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete endpoint request body"
    });
  }
};



