import {
    Response
} from "express";

import mongoose from "mongoose";

import {
    AuthenticatedRequest
} from "../middlewares/auth.middleware.js";

import {
    createEndpointParameter,
    getEndpointParameters,
    getEndpointParameterById,
    updateEndpointParameter,
    deleteEndpointParameter
} from "../services/api-endpoint-parameter.service.js";

import {
    EndpointParameterLocation,
    EndpointParameterDataType
} from "../models/APIEndpointParameter.js";


export const create = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message:
                    "Authentication required"
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
                    "Required resource IDs are missing"
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
                message:
                    "Invalid resource ID"
            });
            return;
        }

        const {
            name,
            location,
            dataType,
            required,
            description,
            defaultValue
        } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim()
        ) {
            res.status(400).json({
                success: false,
                message:
                    "Parameter name is required"
            });
            return;
        }

        if (typeof location !== "string") {
            res.status(400).json({
                success: false,
                message:
                    "Parameter location is required"
            });
            return;
        }

        if (typeof dataType !== "string") {
            res.status(400).json({
                success: false,
                message:
                    "Parameter data type is required"
            });
            return;
        }

        const validatedLocation =
            location as EndpointParameterLocation;

        const validatedDataType =
            dataType as EndpointParameterDataType;

        if (
            required !== undefined &&
            typeof required !== "boolean"
        ) {
            res.status(400).json({
                success: false,
                message:
                    "required must be a boolean"
            });
            return;
        }

        const parameter =
            await createEndpointParameter({
                endpointId,
                apiId,
                apiVersionId: versionId,
                projectId,
                organizationId,

                name,
                location: validatedLocation,
                dataType: validatedDataType,
                required,
                description,
                defaultValue,

                userId: req.user.userId
            });

        res.status(201).json({
            success: true,
            message:
                "Endpoint parameter created successfully",
            data: parameter
        });
    } catch (error) {
        console.error(
            "Create endpoint parameter error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to create endpoint parameter";

        if (
            message.includes("required") ||
            message.includes("Invalid") ||
            message.includes("cannot") ||
            message.includes("does not exist") ||
            message.includes("already exists")
        ) {
            res.status(400).json({
                success: false,
                message
            });
            return;
        }

        if (
            message ===
            "API endpoint not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message:
                "Failed to create endpoint parameter"
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

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Required resource IDs are missing"
            });
            return;
        }

        if (
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        const parameters =
            await getEndpointParameters({
                endpointId,
                apiId,
                apiVersionId: versionId,
                projectId,
                organizationId
            });

        res.status(200).json({
            success: true,
            message: "Endpoint parameters fetched successfully",
            data: parameters
        });
    } catch (error) {
        console.error(
            "List endpoint parameters error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to fetch endpoint parameters";

        if (message === "API endpoint not found") {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to fetch endpoint parameters"
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
            parameterId
        } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string" ||
            typeof parameterId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Required resource IDs are missing"
            });
            return;
        }

        if (
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId) ||
            !mongoose.Types.ObjectId.isValid(parameterId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        const parameter =
            await getEndpointParameterById({
                parameterId,
                endpointId,
                apiId,
                apiVersionId: versionId,
                projectId,
                organizationId
            });

        res.status(200).json({
            success: true,
            message: "Endpoint parameter fetched successfully",
            data: parameter
        });
    } catch (error) {
        console.error(
            "Get endpoint parameter error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to fetch endpoint parameter";

        if (
            message === "API endpoint not found" ||
            message === "Endpoint parameter not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to fetch endpoint parameter"
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
            parameterId
        } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string" ||
            typeof parameterId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Required resource IDs are missing"
            });
            return;
        }

        if (
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId) ||
            !mongoose.Types.ObjectId.isValid(parameterId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        const {
            name,
            location,
            dataType,
            required,
            description,
            defaultValue
        } = req.body;

        if (
            name !== undefined &&
            typeof name !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "name must be a string"
            });
            return;
        }

        if (
            location !== undefined &&
            (
                typeof location !== "string" ||
                !["path", "query", "header"].includes(location)
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid parameter location"
            });
            return;
        }

        if (
            dataType !== undefined &&
            (
                typeof dataType !== "string" ||
                ![
                    "string",
                    "number",
                    "boolean",
                    "date",
                    "objectId"
                ].includes(dataType)
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid parameter data type"
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

        const parameter =
            await updateEndpointParameter({
                parameterId,
                endpointId,
                apiId,
                apiVersionId: versionId,
                projectId,
                organizationId,
                name,
                location:
                    location as EndpointParameterLocation | undefined,
                dataType:
                    dataType as EndpointParameterDataType | undefined,
                required,
                description,
                defaultValue
            });

        res.status(200).json({
            success: true,
            message: "Endpoint parameter updated successfully",
            data: parameter
        });
    } catch (error) {
        console.error(
            "Update endpoint parameter error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to update endpoint parameter";

        if (
            message === "API endpoint not found" ||
            message === "Endpoint parameter not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        if (
            message.includes("required") ||
            message.includes("Invalid") ||
            message.includes("cannot") ||
            message.includes("does not exist") ||
            message.includes("already exists")
        ) {
            res.status(400).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to update endpoint parameter"
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
            parameterId
        } = req.params;

        if (
            typeof organizationId !== "string" ||
            typeof projectId !== "string" ||
            typeof apiId !== "string" ||
            typeof versionId !== "string" ||
            typeof endpointId !== "string" ||
            typeof parameterId !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Required resource IDs are missing"
            });
            return;
        }

        if (
            !mongoose.Types.ObjectId.isValid(organizationId) ||
            !mongoose.Types.ObjectId.isValid(projectId) ||
            !mongoose.Types.ObjectId.isValid(apiId) ||
            !mongoose.Types.ObjectId.isValid(versionId) ||
            !mongoose.Types.ObjectId.isValid(endpointId) ||
            !mongoose.Types.ObjectId.isValid(parameterId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid resource ID"
            });
            return;
        }

        const parameter =
            await deleteEndpointParameter({
                parameterId,
                endpointId,
                apiId,
                apiVersionId: versionId,
                projectId,
                organizationId
            });

        res.status(200).json({
            success: true,
            message: "Endpoint parameter deleted successfully",
            data: {
                id: parameter._id
            }
        });
    } catch (error) {
        console.error(
            "Delete endpoint parameter error:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Failed to delete endpoint parameter";

        if (
            message === "API endpoint not found" ||
            message === "Endpoint parameter not found"
        ) {
            res.status(404).json({
                success: false,
                message
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Failed to delete endpoint parameter"
        });
    }
};
