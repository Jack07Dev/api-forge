import APIEndpoint from "../models/APIEndpoint.js";

import APIEndpointParameter, {
    EndpointParameterDataType,
    EndpointParameterLocation
} from "../models/APIEndpointParameter.js";

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
    userId
}: CreateEndpointParameterInput) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
        throw new Error(
            "Parameter name is required"
        );
    }

    if (trimmedName.length > 100) {
        throw new Error(
            "Parameter name cannot exceed 100 characters"
        );
    }

    if (!allowedLocations.includes(location)) {
        throw new Error(
            "Invalid parameter location"
        );
    }

    if (!allowedDataTypes.includes(dataType)) {
        throw new Error(
            "Invalid parameter data type"
        );
    }

    const endpoint =
        await APIEndpoint.findOne({
            _id: endpointId,
            apiId,
            apiVersionId,
            projectId,
            organizationId,
            status: {
                $ne: "archived"
            }
        });

    if (!endpoint) {
        throw new Error(
            "API endpoint not found"
        );
    }

    // Path parameters must exist in the
    // endpoint path.
    //
    // Example:
    // /customers/{customerId}

    if (location === "path") {
        const pathParameter =
            `{${trimmedName}}`;

        if (
            !endpoint.path.includes(
                pathParameter
            )
        ) {
            throw new Error(
                `Path parameter ${pathParameter} does not exist in endpoint path`
            );
        }
    }

    // Path parameters are always required.

    const finalRequired =
        location === "path"
            ? true
            : required ?? false;

    // Required parameters should not have
    // a default value.

    if (
        finalRequired &&
        defaultValue !== undefined
    ) {
        throw new Error(
            "Required parameters cannot have a default value"
        );
    }

    const existingParameter =
        await APIEndpointParameter.findOne({
            endpointId,
            location,
            name: trimmedName
        });

    if (existingParameter) {
        throw new Error(
            `Parameter ${trimmedName} already exists in ${location}`
        );
    }

    return APIEndpointParameter.create({
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId,

        name: trimmedName,
        location,
        dataType,

        required: finalRequired,

        description:
            description?.trim(),

        defaultValue,

        createdBy: userId
    });
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
    defaultValue
}: UpdateEndpointParameterInput) => {
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

    const parameter = await APIEndpointParameter.findOne({
        _id: parameterId,
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId
    });

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

    // Every path parameter must correspond to the endpoint path.
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

    const duplicate =
        await APIEndpointParameter.findOne({
            _id: { $ne: parameterId },
            endpointId,
            location: finalLocation,
            name: finalName
        });

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

    await parameter.save();

    return parameter;
};

export const deleteEndpointParameter = async ({
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

    const parameter = await APIEndpointParameter.findOne({
        _id: parameterId,
        endpointId,
        apiId,
        apiVersionId,
        projectId,
        organizationId
    });

    if (!parameter) {
        throw new Error("Endpoint parameter not found");
    }

    await parameter.deleteOne();

    return parameter;
};