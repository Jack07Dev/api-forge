
import mongoose from "mongoose";

import APIEndpointDataSource from "../../models/APIEndpointDataSource.js";
import APIModel from "../../models/APIModel.js";

interface ResolveDataSourceInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    endpointId: string;
}

export const resolveDataSource = async ({
    organizationId,
    projectId,
    apiId,
    apiVersionId,
    endpointId,
}: ResolveDataSourceInput) => {
    const ids = [
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        endpointId,
    ];

    // Reject malformed identifiers before querying MongoDB.
    if (
        ids.some(
            (id) =>
                !mongoose.isObjectIdOrHexString(id)
        )
    ) {
        throw new Error("RUNTIME_INVALID_DATA_SOURCE_SCOPE");
    }

    const scope = {
        organizationId,
        projectId,
        apiId,
        apiVersionId,
        endpointId,
    };

    const dataSource =
        await APIEndpointDataSource.findOne({
            ...scope,
            status: "active",
        }).lean();

    // No active database configuration:
    // the endpoint may still use mock execution.
    if (!dataSource) {
        return null;
    }

    const model = await APIModel.findOne({
        _id: dataSource.modelId,
        organizationId,
        projectId,
        apiId,
        versionId: apiVersionId,
        status: "active",
    }).lean();

    if (!model) {
        throw new Error("RUNTIME_DATA_SOURCE_MODEL_NOT_FOUND");
    }

    return {
        dataSource,
        model,
    };
};
