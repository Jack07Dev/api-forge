import type { Response } from "express";
import mongoose from "mongoose";

import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

import {
    createEndpointSecurity,
    getEndpointSecurity,
    updateEndpointSecurity,
    deleteEndpointSecurity
} from "../services/api-endpoint-security.service.js";

export const create = async (
    req: AuthenticatedRequest,
    res: Response,
): Promise<void> => {
    try {
        // Check authenticated user
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
            endpointId,
        } = req.params;

        // Validate URL parameters
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
                message: "Invalid or missing resource ID",
            });
            return;
        }

        const { type, apiKey, bearer } = req.body ?? {};

        // Validate security type
        if (
            type !== "none" &&
            type !== "apiKey" &&
            type !== "bearer"
        ) {
            res.status(400).json({
                success: false,
                message: "Security type must be none, apiKey, or bearer",
            });
            return;
        }

        // Prevent conflicting configurations
        if (
            (type === "none" &&
                (apiKey !== undefined || bearer !== undefined)) ||
            (type === "apiKey" && bearer !== undefined) ||
            (type === "bearer" && apiKey !== undefined)
        ) {
            res.status(400).json({
                success: false,
                message: "Security configuration does not match the selected type",
            });
            return;
        }

        // Validate API key configuration
        if (
            type === "apiKey" &&
            (
                !apiKey ||
                typeof apiKey !== "object" ||
                Array.isArray(apiKey) ||
                typeof apiKey.name !== "string" ||
                !apiKey.name.trim() ||
                apiKey.in !== "header"
            )
        ) {
            res.status(400).json({
                success: false,
                message: "apiKey requires a non-empty name and in: header",
            });
            return;
        }

        // Validate bearer configuration
        if (
            type === "bearer" &&
            bearer !== undefined &&
            (
                !bearer ||
                typeof bearer !== "object" ||
                Array.isArray(bearer) ||
                (
                    bearer.bearerFormat !== undefined &&
                    (
                        typeof bearer.bearerFormat !== "string" ||
                        !bearer.bearerFormat.trim()
                    )
                )
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid bearer configuration",
            });
            return;
        }

        const security = await createEndpointSecurity({
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId,
            endpointId,
            createdBy: req.user.userId,
            type,

            ...(type === "apiKey"
                ? {
                    apiKey: {
                        name: apiKey.name,
                        in: "header",
                    },
                }
                : {}),

            ...(type === "bearer" && bearer
                ? {
                    bearer: {
                        bearerFormat: bearer.bearerFormat,
                    },
                }
                : {}),
        });

        res.status(201).json({
            success: true,
            message: "Endpoint security configuration created successfully",
            data: security,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "ENDPOINT_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "Endpoint not found",
            });
            return;
        }

        if (
            error instanceof Error &&
            error.message === "SECURITY_ALREADY_EXISTS"
        ) {
            res.status(409).json({
                success: false,
                message: "Security configuration already exists for this endpoint",
            });
            return;
        }

        if (
            error instanceof Error &&
            (
                error.message === "INVALID_API_KEY_CONFIG" ||
                error.message === "INVALID_BEARER_CONFIG"
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid endpoint security configuration",
            });
            return;
        }

        if (error instanceof mongoose.Error.ValidationError) {
            res.status(400).json({
                success: false,
                message: "Security configuration validation failed",
            });
            return;
        }

        // Handle MongoDB duplicate key error
        if (
            error instanceof Error &&
            "code" in error &&
            error.code === 11000
        ) {
            res.status(409).json({
                success: false,
                message: "Security configuration already exists for this endpoint",
            });
            return;
        }

        console.error("Create endpoint security error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create endpoint security configuration",
        });
    }
};

export const list = async (
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
            endpointId,
        } = req.params;

        // Explicit validation for Express 5 + TypeScript
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
                message: "Invalid or missing resource ID",
            });
            return;
        }

        const security = await getEndpointSecurity({
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId,
            endpointId,
        });

        res.status(200).json({
            success: true,
            message: "Endpoint security configuration fetched successfully",
            data: security,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "ENDPOINT_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "Endpoint not found",
            });
            return;
        }

        if (
            error instanceof Error &&
            error.message === "SECURITY_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "Endpoint security configuration not found",
            });
            return;
        }

        console.error("Get endpoint security error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch endpoint security configuration",
        });
    }
};

export const update = async (
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
            endpointId,
        } = req.params;

        // Validate resource IDs (Express 5 + TypeScript)
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
                message: "Invalid or missing resource ID",
            });
            return;
        }

        // Validate request body
        const body = req.body;

        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body)
        ) {
            res.status(400).json({
                success: false,
                message: "A valid JSON object is required",
            });
            return;
        }

        const { type, apiKey, bearer } = body;

        if (
            type !== "none" &&
            type !== "apiKey" &&
            type !== "bearer"
        ) {
            res.status(400).json({
                success: false,
                message: "Security type must be none, apiKey, or bearer",
            });
            return;
        }

        // Reject configurations belonging to another type
        if (
            (type === "none" &&
                (apiKey !== undefined || bearer !== undefined)) ||
            (type === "apiKey" && bearer !== undefined) ||
            (type === "bearer" && apiKey !== undefined)
        ) {
            res.status(400).json({
                success: false,
                message: "Security configuration does not match the selected type",
            });
            return;
        }

        // Validate API key configuration
        if (
            type === "apiKey" &&
            (
                !apiKey ||
                typeof apiKey !== "object" ||
                Array.isArray(apiKey) ||
                typeof apiKey.name !== "string" ||
                !apiKey.name.trim() ||
                apiKey.in !== "header"
            )
        ) {
            res.status(400).json({
                success: false,
                message: "apiKey requires a non-empty name and in: header",
            });
            return;
        }

        // Validate bearer configuration
        if (
            type === "bearer" &&
            bearer !== undefined &&
            (
                !bearer ||
                typeof bearer !== "object" ||
                Array.isArray(bearer) ||
                (
                    bearer.bearerFormat !== undefined &&
                    (
                        typeof bearer.bearerFormat !== "string" ||
                        !bearer.bearerFormat.trim()
                    )
                )
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid bearer configuration",
            });
            return;
        }

        // Update existing security configuration
        const security = await updateEndpointSecurity({
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId,
            endpointId,
            type,

            ...(type === "apiKey"
                ? {
                    apiKey: {
                        name: apiKey.name,
                        in: "header",
                    },
                }
                : {}),

            ...(type === "bearer" && bearer
                ? {
                    bearer: {
                        bearerFormat: bearer.bearerFormat,
                    },
                }
                : {}),
        });

        res.status(200).json({
            success: true,
            message: "Endpoint security configuration updated successfully",
            data: security,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "ENDPOINT_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "Endpoint not found",
            });
            return;
        }

        if (
            error instanceof Error &&
            error.message === "SECURITY_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "Endpoint security configuration not found",
            });
            return;
        }

        if (
            error instanceof Error &&
            (
                error.message === "INVALID_API_KEY_CONFIG" ||
                error.message === "INVALID_BEARER_CONFIG"
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid endpoint security configuration",
            });
            return;
        }

        if (error instanceof mongoose.Error.ValidationError) {
            res.status(400).json({
                success: false,
                message: "Security configuration validation failed",
            });
            return;
        }

        console.error("Update endpoint security error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update endpoint security configuration",
        });
    }
};

export const remove = async (
    req: AuthenticatedRequest,
    res: Response,
): Promise<void> => {
    try {
        // 1. Verify authenticated user
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
            endpointId,
        } = req.params;

        // 2. Validate resource IDs
        // Explicit checks support Express 5 + TypeScript
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
                message: "Invalid or missing resource ID",
            });
            return;
        }

        // 3. Delete endpoint security configuration
        const deletedSecurity = await deleteEndpointSecurity({
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId,
            endpointId,
        });

        // 4. Return success response
        res.status(200).json({
            success: true,
            message: "Endpoint security configuration deleted successfully",
            data: deletedSecurity,
        });
    } catch (error) {
        // Endpoint not found
        if (
            error instanceof Error &&
            error.message === "ENDPOINT_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "Endpoint not found",
            });
            return;
        }

        // Security configuration not found
        if (
            error instanceof Error &&
            error.message === "SECURITY_NOT_FOUND"
        ) {
            res.status(404).json({
                success: false,
                message: "Endpoint security configuration not found",
            });
            return;
        }

        console.error("Delete endpoint security error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete endpoint security configuration",
        });
    }
};