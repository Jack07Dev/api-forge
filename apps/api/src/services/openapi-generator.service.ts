
import mongoose from "mongoose";

import API from "../models/API.js";
import APIVersion from "../models/APIVersion.js";
import APIModel from "../models/APIModel.js";
import APIEndpoint from "../models/APIEndpoint.js";
import APIEndpointParameter from "../models/APIEndpointParameter.js";
import APIEndpointRequestBody from "../models/APIEndpointRequestBody.js";
import APIEndpointResponse from "../models/APIEndpointResponse.js";
import APIEndpointSecurity from "../models/APIEndpointSecurity.js";

type JsonSchema = Record<string, unknown>;
type OpenAPIObject = Record<string, any>;

type GeneratorInput = {
    organizationId: string;
    projectId: string;
    apiId: string;
    versionId: string;
};

const toSchemaName = (name: string): string => {
    const sanitized = name
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "");

    return sanitized || "UnnamedSchema";
};

const toSchema = (type: string): JsonSchema => {
    switch (type) {
        case "number":
            return { type: "number" };
        case "boolean":
            return { type: "boolean" };
        case "date":
            return { type: "string", format: "date-time" };
        case "objectId":
            return {
                type: "string",
                pattern: "^[a-fA-F0-9]{24}$"
            };
        default:
            return { type: "string" };
    }
};

export const generateOpenAPISpec = async ({
    organizationId,
    projectId,
    apiId,
    versionId
}: GeneratorInput): Promise<OpenAPIObject> => {
    const ids = [
        organizationId,
        projectId,
        apiId,
        versionId
    ];

    if (!ids.every(mongoose.isValidObjectId)) {
        throw new Error("Invalid organization, project, API or version ID");
    }

    const scope = {
        organizationId,
        projectId,
        apiId
    };

    const api = await API.findOne({
        _id: apiId,
        organizationId,
        projectId
    });

    if (!api) {
        throw new Error("API not found");
    }

    const version = await APIVersion.findOne({
        _id: versionId,
        ...scope
    });

    if (!version) {
        throw new Error("API version not found");
    }

    const [models, endpoints] = await Promise.all([
        APIModel.find({
            ...scope,
            versionId,
            status: { $ne: "archived" }
        }),
        APIEndpoint.find({
            ...scope,
            apiVersionId: versionId,
            status: { $ne: "archived" }
        })
    ]);

    const endpointIds = endpoints.map((e) => e._id);

    const [
        parameters,
        requestBodies,
        responses,
        securityRecords
    ] = await Promise.all([
        APIEndpointParameter.find({
            ...scope,
            apiVersionId: versionId,
            endpointId: { $in: endpointIds }
        }),
        APIEndpointRequestBody.find({
            ...scope,
            apiVersionId: versionId,
            endpointId: { $in: endpointIds }
        }),
        APIEndpointResponse.find({
            ...scope,
            apiVersionId: versionId,
            endpointId: { $in: endpointIds }
        }),
        APIEndpointSecurity.find({
            ...scope,
            apiVersionId: versionId,
            endpointId: { $in: endpointIds }
        })
    ]);

    const schemas: Record<string, JsonSchema> = {};
    const modelNames = new Map<string, string>();

    for (const model of models) {
        const schemaName = toSchemaName(model.name);

        if (Object.hasOwn(schemas, schemaName)) {
            throw new Error(`Duplicate schema name: ${schemaName}`);
        }

        const properties: Record<string, JsonSchema> = {};
        const required: string[] = [];

        for (const field of model.fields) {
            properties[field.name] = {
                ...toSchema(field.type),
                ...(field.description
                    ? { description: field.description }
                    : {})
            };

            if (field.required) {
                required.push(field.name);
            }
        }

        schemas[schemaName] = {
            type: "object",
            properties,
            ...(required.length ? { required } : {}),
            ...(model.description
                ? { description: model.description }
                : {})
        };

        modelNames.set(String(model._id), schemaName);
    }

    const modelRef = (id: unknown): JsonSchema => {
        const name = modelNames.get(String(id));

        if (!name) {
            throw new Error(`Referenced API model not found: ${id}`);
        }

        return {
            $ref: `#/components/schemas/${name.replace(/~/g, "~0").replace(/\//g, "~1")}`
        };
    };

    const paths: Record<string, OpenAPIObject> = {};
    const securitySchemes: Record<string, unknown> = {};

    for (const endpoint of endpoints) {
        const endpointId = String(endpoint._id);
        const method = endpoint.method.toLowerCase();

        const operation: OpenAPIObject = {
            summary: endpoint.name,
            ...(endpoint.description
                ? { description: endpoint.description }
                : {}),
            responses: {}
        };

        const endpointParameters = parameters.filter(
            (p) => String(p.endpointId) === endpointId
        );

        if (endpointParameters.length) {
            operation.parameters = endpointParameters.map((p) => ({
                name: p.name,
                in: p.location,
                required: p.location === "path" ? true : p.required,
                ...(p.description
                    ? { description: p.description }
                    : {}),
                schema: {
                    ...toSchema(p.dataType),
                    ...(p.defaultValue !== undefined
                        ? { default: p.defaultValue }
                        : {})
                }
            }));
        }

        const body = requestBodies.find(
            (b) => String(b.endpointId) === endpointId
        );

        if (body) {
            operation.requestBody = {
                required: body.required,
                content: {
                    [body.contentType]: {
                        schema: modelRef(body.modelId)
                    }
                }
            };
        }

        const endpointResponses = responses.filter(
            (r) => String(r.endpointId) === endpointId
        );

        for (const response of endpointResponses) {
            const responseObject: OpenAPIObject = {
                description: response.description || "API response"
            };

            if (response.modelId && response.contentType) {
                responseObject.content = {
                    [response.contentType]: {
                        schema: modelRef(response.modelId)
                    }
                };
            }

            operation.responses[String(response.statusCode)] = responseObject;
        }

        const security = securityRecords.find(
            (s) => String(s.endpointId) === endpointId
        );

        if (security?.type === "none") {
            operation.security = [];
        } else if (security?.type === "bearer") {
            const name = "BearerAuth";

            securitySchemes[name] = {
                type: "http",
                scheme: "bearer",
                ...(security.bearer?.bearerFormat
                    ? { bearerFormat: security.bearer.bearerFormat }
                    : {})
            };

            operation.security = [{ [name]: [] }];
        } else if (security?.type === "apiKey") {
            if (!security.apiKey) {
                throw new Error(`Missing API key details: ${endpointId}`);
            }

            const name = `ApiKey_${security.apiKey.name.replace(/[^a-zA-Z0-9_]/g, "_")}`;

            securitySchemes[name] = {
                type: "apiKey",
                name: security.apiKey.name,
                in: security.apiKey.in
            };

            operation.security = [{ [name]: [] }];
        }

        paths[endpoint.path] ??= {};

        if (paths[endpoint.path][method]) {
            throw new Error(
                `Duplicate operation: ${endpoint.method} ${endpoint.path}`
            );
        }

        paths[endpoint.path][method] = operation;
    }

    return {
        openapi: "3.1.0",
        info: {
            title: api.name,
            version: version.versionLabel,
            ...(api.description
                ? { description: api.description }
                : {})
        },
        paths,
        components: {
            schemas,
            securitySchemes
        }
    };
};
