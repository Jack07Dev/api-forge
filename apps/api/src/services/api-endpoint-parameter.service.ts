import APIEndpoint from "../models/APIEndpoint.js";

import APIEndpointParameter, {
    EndpointParameterDataType,
    EndpointParameterLocation
} from "../models/APIEndpointParameter.js";

import {
    assertDraftAPIVersion,
    withDraftVersionTransaction
} from "./api-version-guard.service.js";

interface CreateEndpointParameterInput {
    endpointId: string;

    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;

    name: string;
    location: EndpointParameterLocation;
    dataType: EndpointParameterDataType;

    required?: boolean;
    description?: string;
    defaultValue?: unknown;

    userId: string;
}

interface UpdateEndpointParameterInput {
    parameterId: string;
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
    name?: string;
    location?: EndpointParameterLocation;
    dataType?: EndpointParameterDataType;
    required?: boolean;
    description?: string;
    defaultValue?: unknown;
}


const allowedLocations:
    EndpointParameterLocation[] = [
        "path",
        "query",
        "header"
    ];

const allowedDataTypes:
    EndpointParameterDataType[] = [
        "string",
        "number",
        "boolean",
        "date",
        "objectId"
    ];

export const createEndpointParameter = async ({
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId,
    name,
    location,
    dataType,
    required,
    description,
    defaultValue,
    userId,
}: CreateEndpointParameterInput) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
        throw new Error("Parameter name is required");
    }

    if (trimmedName.length > 100) {
        throw new Error("Parameter name cannot exceed 100 characters");
    }

    if (!allowedLocations.includes(location)) {
        throw new Error("Invalid parameter location");
    }

    if (!allowedDataTypes.includes(dataType)) {
        throw new Error("Invalid parameter data type");
    }

    return withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        },
        async (session) => {
            const endpoint = await APIEndpoint.findOne({
                _id: endpointId,
                apiId,
                apiVersionId,
                projectId,
                organizationId,
                status: { $ne: "archived" },
            }).session(session);

            if (!endpoint) {
                throw new Error("API endpoint not found");
            }

            if (location === "path") {
                const pathParameter = `{${trimmedName}}`;

                if (!endpoint.path.includes(pathParameter)) {
                    throw new Error(
                        `Path parameter ${pathParameter} does not exist in endpoint path`
                    );
                }
            }

            const finalRequired =
                location === "path" ? true : required ?? false;

            if (finalRequired && defaultValue !== undefined) {
                throw new Error(
                    "Required parameters cannot have a default value"
                );
            }

            const existingParameter =
                await APIEndpointParameter.findOne({
                    endpointId,
                    location,
                    name: trimmedName,
                }).session(session);

            if (existingParameter) {
                throw new Error(
                    `Parameter ${trimmedName} already exists in ${location}`
                );
            }

            const [parameter] = await APIEndpointParameter.create(
                [
                    {
                        endpointId,
                        apiId,
                        apiVersionId,
                        projectId,
                        organizationId,
                        name: trimmedName,
                        location,
                        dataType,
                        required: finalRequired,
                        description: description?.trim(),
                        defaultValue,
                        createdBy: userId,
                    },
                ],
                { session }
            );

            return parameter;
        }
    );
};

export const getEndpointParameters = async ({
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId
}: {
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
}) => {
    // Make sure endpoint belongs to this exact resource hierarchy
    // and is not archived.
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,
        status: { $ne: "archived" }
    });

    if (!endpoint) {
        throw new Error("API endpoint not found");
    }

    return APIEndpointParameter.find({
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId
    })
        .sort({
            location: 1,
            createdAt: 1
        })
        .lean();
};

export const getEndpointParameterById = async ({
    parameterId,
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId
}: {
    parameterId: string;
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
}) => {
    // First verify the endpoint belongs to the complete hierarchy
    // and has not been archived.
    const endpoint = await APIEndpoint.findOne({
        _id: endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,
        status: { $ne: "archived" }
    });

    if (!endpoint) {
        throw new Error("API endpoint not found");
    }

    // Then retrieve the parameter using the same hierarchy.
    const parameter = await APIEndpointParameter.findOne({
        _id: parameterId,
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId
    }).lean();

    if (!parameter) {
        throw new Error("Endpoint parameter not found");
    }

    return parameter;
};

export const updateEndpointParameter = async ({
    parameterId,
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId,
    name,
    location,
    dataType,
    required,
    description,
    defaultValue,
}: UpdateEndpointParameterInput) => {
    return withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        },
        async (session) => {
            const endpoint = await APIEndpoint.findOne({
                _id: endpointId,
                apiId,
                apiVersionId,
                projectId,
                organizationId,
                status: { $ne: "archived" },
            }).session(session);

            if (!endpoint) {
                throw new Error("API endpoint not found");
            }

            const parameter = await APIEndpointParameter.findOne({
                _id: parameterId,
                endpointId,
                apiId,
                apiVersionId,
                projectId,
                organizationId,
            }).session(session);

            if (!parameter) {
                throw new Error("Endpoint parameter not found");
            }

            const finalName =
                name !== undefined ? name.trim() : parameter.name;

            const finalLocation =
                location !== undefined ? location : parameter.location;

            const finalDataType =
                dataType !== undefined ? dataType : parameter.dataType;

            let finalRequired =
                required !== undefined ? required : parameter.required;

            const finalDescription =
                description !== undefined
                    ? description.trim()
                    : parameter.description;

            const finalDefaultValue =
                defaultValue !== undefined
                    ? defaultValue
                    : parameter.defaultValue;

            if (!finalName) {
                throw new Error("Parameter name is required");
            }

            if (finalName.length > 100) {
                throw new Error(
                    "Parameter name cannot exceed 100 characters"
                );
            }

            if (!allowedLocations.includes(finalLocation)) {
                throw new Error("Invalid parameter location");
            }

            if (!allowedDataTypes.includes(finalDataType)) {
                throw new Error("Invalid parameter data type");
            }

            // Path parameters must exist in the endpoint path.
            if (finalLocation === "path") {
                const placeholder = `{${finalName}}`;

                if (!endpoint.path.includes(placeholder)) {
                    throw new Error(
                        `Path parameter ${placeholder} does not exist in endpoint path`
                    );
                }

                finalRequired = true;
            }

            if (
                finalRequired &&
                finalDefaultValue !== undefined
            ) {
                throw new Error(
                    "Required parameters cannot have a default value"
                );
            }

            const duplicate = await APIEndpointParameter.findOne({
                _id: { $ne: parameterId },
                endpointId,
                location: finalLocation,
                name: finalName,
            }).session(session);

            if (duplicate) {
                throw new Error(
                    `Parameter ${finalName} already exists in ${finalLocation}`
                );
            }

            parameter.name = finalName;
            parameter.location = finalLocation;
            parameter.dataType = finalDataType;
            parameter.required = finalRequired;
            parameter.description = finalDescription;

            if (finalDefaultValue !== undefined) {
                parameter.defaultValue = finalDefaultValue;
            }

            await parameter.save({ session });

            return parameter;
        }
    );
};

export const deleteEndpointParameter = async ({
    parameterId,
    endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId,
}: {
    parameterId: string;
    endpointId: string;
    apiId: string;
    apiVersionId: string;
    projectId: string;
    organizationId: string;
}) => {
    return withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId,
        },
        async (session) => {
            // 1. Verify the endpoint exists and is not archived.
            const endpoint = await APIEndpoint.findOne({
                _id: endpointId,
                apiId,
                apiVersionId,
                projectId,
                organizationId,
                status: { $ne: "archived" },
            }).session(session);

            if (!endpoint) {
                throw new Error("API endpoint not found");
            }

            // 2. Find the parameter within the correct hierarchy.
            const parameter = await APIEndpointParameter.findOne({
                _id: parameterId,
                endpointId,
                apiId,
                apiVersionId,
                projectId,
                organizationId,
            }).session(session);

            if (!parameter) {
                throw new Error("Endpoint parameter not found");
            }

            // 3. Delete the parameter using the same transaction.
            await parameter.deleteOne({ session });

            return parameter;
        }
    );
};