import APIEndpointParameter from "../../models/APIEndpointParameter.js";
import APIEndpointRequestBody from "../../models/APIEndpointRequestBody.js";
import APIModel from "../../models/APIModel.js";

interface ResolveRequestValidationInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    endpointId: string;
}

export const resolveRequestValidation = async ({
    organizationId,
    projectId,
    apiId,
    apiVersionId,
    endpointId,
}: ResolveRequestValidationInput) => {
    const scope = {
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        endpointId,
    };

    const [parameters, requestBody] = await Promise.all([
        APIEndpointParameter.find(scope).lean(),

        APIEndpointRequestBody.findOne(scope).lean(),
    ]);

    if (!requestBody) {
        return {
            parameters,
            requestBody: null,
            fields: [],
        };
    }

    const model = await APIModel.findOne({
        _id: requestBody.modelId,
        organizationId,
        projectId,
        apiId,
        versionId: apiVersionId,
    }).lean();

    if (!model) {
        throw new Error("RUNTIME_REQUEST_MODEL_NOT_FOUND");
    }

    return {
        parameters,
        requestBody,
        fields: model.fields,
    };
};