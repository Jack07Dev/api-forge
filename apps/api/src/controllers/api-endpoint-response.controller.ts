
import { Response } from "express";
import mongoose from "mongoose";

import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
    createEndpointResponse,
    getEndpointResponses,
    getEndpointResponseById,
    updateEndpointResponse,
    deleteEndpointResponse
} from "../services/api-endpoint-response.service.js";

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

        // Explicit validation for Express 5 TypeScript narrowing
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

        const {
            statusCode,
            description,
            contentType,
            modelId
        } = req.body ?? {};

        if (
            typeof statusCode !== "number" ||
            !Number.isInteger(statusCode) ||
            statusCode < 200 ||
            statusCode > 599
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid HTTP status code"
            });
            return;
        }

        if (
            description !== undefined &&
            (typeof description !== "string" ||
                description.length > 500)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid response description"
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
            modelId !== undefined &&
            (typeof modelId !== "string" || !modelId.trim())
        ) {
            res.status(400).json({
                success: false,
                message: "modelId must be a valid string"
            });
            return;
        }

        const responseConfig = await createEndpointResponse({
            endpointId,
            apiId,
            apiVersionId: versionId,
            projectId,
            organizationId,
            statusCode,
            description,
            contentType,
            modelId,
            userId: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: "Endpoint response created successfully",
            data: responseConfig
        });
    } catch (error) {
        console.error("Create endpoint response error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Failed to create endpoint response";

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
            message === "Invalid HTTP status code" ||
            message === "Unsupported content type" ||
            message === "Invalid model ID" ||
            message === "This HTTP status code cannot have a response body" ||
            message === "modelId and contentType must be provided together"
        ) {
            res.status(400).json({
                success: false,
                message
            });
            return;
        }

        if (
            message.includes("already exists") ||
            (
                error instanceof Error &&
                error.name === "MongoServerError" &&
                "code" in error &&
                error.code === 11000
            )
        ) {
            res.status(409).json({
                success: false,
                message: "Response configuration already exists for this status code"
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to create endpoint response"
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
            versionId,
            endpointId
        } = req.params;

        // Explicit checks for Express 5 TypeScript narrowing
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

        const responses = await getEndpointResponses({
            endpointId,
            apiId,
            apiVersionId: versionId,
            projectId,
            organizationId
        });

        res.status(200).json({
            success: true,
            message: "Endpoint responses fetched successfully",
            count: responses.length,
            data: responses
        });
    } catch (error) {
        console.error("List endpoint responses error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Failed to fetch endpoint responses";

        if (message === "API endpoint not found") {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to fetch endpoint responses"
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
            endpointId,
            responseId
        } = req.params;

        // Express 5: explicitly narrow all IDs to string
        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string" ||
            typeof responseId !== "string" ||
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId) ||
            !mongoose.Types.ObjectId.isValid(responseId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid or missing resource ID"
            });
            return;
        }

        const response = await getEndpointResponseById({
            responseId,
            endpointId,
            apiId,
            apiVersionId: versionId,
            projectId,
            organizationId
        });

        res.status(200).json({
            success: true,
            message: "Endpoint response fetched successfully",
            data: response
        });
    } catch (error) {
        console.error("Get endpoint response error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Failed to fetch endpoint response";

        if (
            message === "API endpoint not found" ||
            message === "Endpoint response not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to fetch endpoint response"
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
            endpointId,
            responseId
        } = req.params;

        // Express 5 requires explicit type narrowing
        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string" ||
            typeof responseId !== "string" ||
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId) ||
            !mongoose.Types.ObjectId.isValid(responseId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid or missing resource ID"
            });
            return;
        }

        const {
            statusCode,
            description,
            contentType,
            modelId
        } = req.body ?? {};

        // Require at least one update field
        if (
            statusCode === undefined &&
            description === undefined &&
            contentType === undefined &&
            modelId === undefined
        ) {
            res.status(400).json({
                success: false,
                message: "At least one field is required"
            });
            return;
        }

        if (
            statusCode !== undefined &&
            (typeof statusCode !== "number" ||
                !Number.isInteger(statusCode) ||
                statusCode < 200 ||
                statusCode > 599)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid HTTP status code"
            });
            return;
        }

        if (
            description !== undefined &&
            (typeof description !== "string" ||
                description.length > 500)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid response description"
            });
            return;
        }

        if (
            contentType !== undefined &&
            contentType !== null &&
            typeof contentType !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid content type"
            });
            return;
        }

        if (
            modelId !== undefined &&
            modelId !== null &&
            (typeof modelId !== "string" || !modelId.trim())
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid model ID"
            });
            return;
        }

        const responseConfig = await updateEndpointResponse({
            responseId,
            endpointId,
            apiId,
            apiVersionId: versionId,
            projectId,
            organizationId,
            statusCode,
            description,
            contentType,
            modelId
        });

        res.status(200).json({
            success: true,
            message: "Endpoint response updated successfully",
            data: responseConfig
        });
    } catch (error) {
        console.error("Update endpoint response error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Failed to update endpoint response";

        if (
            message === "API endpoint not found" ||
            message === "Endpoint response not found" ||
            message === "API model not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        if (
            message === "Invalid HTTP status code" ||
            message === "Unsupported content type" ||
            message === "Invalid model ID" ||
            message === "modelId and contentType must be provided together" ||
            message === "This HTTP status code cannot have a response body"
        ) {
            res.status(400).json({
                success: false,
                message
            });
            return;
        }

        if (
            message.includes("already exists") ||
            (
                error instanceof Error &&
                error.name === "MongoServerError" &&
                "code" in error &&
                error.code === 11000
            )
        ) {
            res.status(409).json({
                success: false,
                message: "Response configuration already exists for this status code"
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to update endpoint response"
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
            endpointId,
            responseId
        } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string" ||
            typeof responseId !== "string" ||
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId) ||
            !mongoose.Types.ObjectId.isValid(responseId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid or missing resource ID"
            });
            return;
        }

        const deletedResponse = await deleteEndpointResponse({
            responseId,
            endpointId,
            apiId,
            apiVersionId: versionId,
            projectId,
            organizationId
        });

        res.status(200).json({
            success: true,
            message: "Endpoint response deleted successfully",
            data: {
                id: deletedResponse._id,
                statusCode: deletedResponse.statusCode
            }
        });
    } catch (error) {
        console.error("Delete endpoint response error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Failed to delete endpoint response";

        if (
            message === "API endpoint not found" ||
            message === "Endpoint response not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to delete endpoint response"
        });
    }
};


