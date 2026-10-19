
import type { Response } from "express";
import mongoose from "mongoose";

import type {
    AuthenticatedRequest,
} from "../middlewares/auth.middleware.js";

import {
    createEndpointMock,
    getEndpointMock,
    updateEndpointMock,
    deleteEndpointMock,
} from "../services/api-endpoint-mock.service.js";

type MockScope = {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    endpointId: string;
};

const getScope = (
    req: AuthenticatedRequest
): MockScope | null => {
    const {
        organizationId,
        projectId,
        apiId,
        versionId,
        endpointId,
    } = req.params;

    const ids = [
        organizationId,
        projectId,
        apiId,
        versionId,
        endpointId,
    ];

    if (
        ids.some(
            (id) =>
                typeof id !== "string" ||
                !mongoose.Types.ObjectId.isValid(id)
        )
    ) {
        return null;
    }

    return {
        organizationId: organizationId as string,
        projectId: projectId as string,
        apiId: apiId as string,
        apiVersionId: versionId as string,
        endpointId: endpointId as string,
    };
};

const handleError = (
    error: unknown,
    res: Response
): void => {
    const message =
        error instanceof Error
            ? error.message
            : "Unexpected error";

    if (
        message.startsWith("INVALID_MOCK_") ||
        message.startsWith("MOCK_STATUS_") ||
        message === "MOCK_RESPONSE_TOO_LARGE"
    ) {
        res.status(400).json({
            success: false,
            message,
        });
        return;
    }

    if (
        message === "Mock response already exists" ||
        message.includes("E11000")
    ) {
        res.status(409).json({
            success: false,
            message: "Mock response already exists",
        });
        return;
    }

    if (
        message === "API endpoint not found" ||
        message === "Mock response not found" ||
        message === "API version not found"
    ) {
        res.status(404).json({
            success: false,
            message,
        });
        return;
    }

    if (
        message.startsWith(
            "Cannot modify API definitions"
        ) ||
        message ===
        "API version not found or is not available for modification"
    ) {
        res.status(409).json({
            success: false,
            message,
        });
        return;
    }

    console.error("Mock configuration error:", error);

    res.status(500).json({
        success: false,
        message: "Internal server error",
    });
};

const validateRequest = (
    req: AuthenticatedRequest,
    res: Response
): MockScope | null => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: "Authentication required",
        });
        return null;
    }

    const scope = getScope(req);

    if (!scope) {
        res.status(400).json({
            success: false,
            message: "Invalid resource ID",
        });
        return null;
    }

    return scope;
};

// POST — Create mock
export const createMock = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const scope = validateRequest(req, res);
    if (!scope) return;

    try {
        const mock = await createEndpointMock(
            scope,
            {
                statusCode: req.body?.statusCode,
                responseBody: req.body?.responseBody,
            }
        );

        res.status(201).json({
            success: true,
            message: "Mock response created successfully",
            data: mock,
        });
    } catch (error) {
        handleError(error, res);
    }
};

// GET — Retrieve mock
export const getMock = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const scope = validateRequest(req, res);
    if (!scope) return;

    try {
        const mock = await getEndpointMock(scope);

        if (!mock) {
            res.status(404).json({
                success: false,
                message: "Mock response not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: mock,
        });
    } catch (error) {
        handleError(error, res);
    }
};

// PATCH — Update mock
export const updateMock = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const scope = validateRequest(req, res);
    if (!scope) return;

    try {
        const mock = await updateEndpointMock(
            scope,
            {
                statusCode: req.body?.statusCode,
                responseBody: req.body?.responseBody,
            }
        );

        res.status(200).json({
            success: true,
            message: "Mock response updated successfully",
            data: mock,
        });
    } catch (error) {
        handleError(error, res);
    }
};

// DELETE — Remove mock
export const deleteMock = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    const scope = validateRequest(req, res);
    if (!scope) return;

    try {
        await deleteEndpointMock(scope);

        res.status(200).json({
            success: true,
            message: "Mock response deleted successfully",
        });
    } catch (error) {
        handleError(error, res);
    }
};
