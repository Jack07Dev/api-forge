import mongoose, { Schema, type Document } from "mongoose";

export interface IAPIEndpointMockResponse extends Document {
    organizationId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    apiId: mongoose.Types.ObjectId;
    apiVersionId: mongoose.Types.ObjectId;
    endpointId: mongoose.Types.ObjectId;

    statusCode: number;
    responseBody: unknown;
    createdAt: Date;
    updatedAt: Date;
}

const apiEndpointMockResponseSchema =
    new Schema<IAPIEndpointMockResponse>(
        {
            organizationId: {
                type: Schema.Types.ObjectId,
                required: true,
            },
            projectId: {
                type: Schema.Types.ObjectId,
                required: true,
            },
            apiId: {
                type: Schema.Types.ObjectId,
                required: true,
            },
            apiVersionId: {
                type: Schema.Types.ObjectId,
                required: true,
            },
            endpointId: {
                type: Schema.Types.ObjectId,
                required: true,
            },
            statusCode: {
                type: Number,
                required: true,
                min: 200,
                max: 599,
                validate: Number.isInteger,
            },
            responseBody: {
                type: Schema.Types.Mixed,
                required: true,
            },
        },
        {
            timestamps: true,
        }
    );

apiEndpointMockResponseSchema.index(
    {
        organizationId: 1,
        projectId: 1,
        apiId: 1,
        apiVersionId: 1,
        endpointId: 1,
    },
    { unique: true }
);

const APIEndpointMockResponse =
    mongoose.model<IAPIEndpointMockResponse>(
        "APIEndpointMockResponse",
        apiEndpointMockResponseSchema
    );

export default APIEndpointMockResponse;