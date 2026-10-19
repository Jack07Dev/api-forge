
import mongoose, { Document, Schema } from "mongoose";

export type APIDataSourceOperation =
    | "findMany"
    | "findOne"
    | "create"
    | "update"
    | "delete";

export type APIDataSourceStatus =
    | "draft"
    | "active"
    | "archived";

export interface IAPIEndpointDataSource extends Document {
    endpointId: mongoose.Types.ObjectId;
    apiId: mongoose.Types.ObjectId;
    apiVersionId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;

    modelId: mongoose.Types.ObjectId;
    operation: APIDataSourceOperation;

    status: APIDataSourceStatus;
    createdBy: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const apiEndpointDataSourceSchema =
    new Schema<IAPIEndpointDataSource>(
        {
            endpointId: {
                type: Schema.Types.ObjectId,
                ref: "APIEndpoint",
                required: true,
                immutable: true,
            },

            apiId: {
                type: Schema.Types.ObjectId,
                ref: "API",
                required: true,
                immutable: true,
            },

            apiVersionId: {
                type: Schema.Types.ObjectId,
                ref: "APIVersion",
                required: true,
                immutable: true,
            },

            projectId: {
                type: Schema.Types.ObjectId,
                ref: "Project",
                required: true,
                immutable: true,
            },

            organizationId: {
                type: Schema.Types.ObjectId,
                ref: "Organization",
                required: true,
                immutable: true,
            },

            modelId: {
                type: Schema.Types.ObjectId,
                ref: "APIModel",
                required: true,
            },

            operation: {
                type: String,
                enum: [
                    "findMany",
                    "findOne",
                    "create",
                    "update",
                    "delete",
                ],
                required: true,
            },

            status: {
                type: String,
                enum: ["draft", "active", "archived"],
                default: "draft",
                required: true,
            },

            createdBy: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
                immutable: true,
            },
        },
        {
            timestamps: true,
            strict: "throw",
        }
    );

// One data-source configuration per endpoint.
apiEndpointDataSourceSchema.index(
    { endpointId: 1 },
    { unique: true }
);

// Scoped lookup for runtime execution.
apiEndpointDataSourceSchema.index({
    organizationId: 1,
    projectId: 1,
    apiId: 1,
    apiVersionId: 1,
    endpointId: 1,
});

// Scoped lookup by API model.
apiEndpointDataSourceSchema.index({
    organizationId: 1,
    projectId: 1,
    apiId: 1,
    apiVersionId: 1,
    modelId: 1,
});

const APIEndpointDataSource =
    mongoose.model<IAPIEndpointDataSource>(
        "APIEndpointDataSource",
        apiEndpointDataSourceSchema
    );

export default APIEndpointDataSource;
