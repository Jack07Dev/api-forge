
import mongoose, { Document, Schema } from "mongoose";

export interface IAPIEndpointResponse extends Document {
    endpointId: mongoose.Types.ObjectId;
    apiId: mongoose.Types.ObjectId;
    apiVersionId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;

    statusCode: number;
    description?: string;
    contentType?: string;
    modelId?: mongoose.Types.ObjectId;

    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const apiEndpointResponseSchema =
    new Schema<IAPIEndpointResponse>(
        {
            endpointId: {
                type: Schema.Types.ObjectId,
                ref: "APIEndpoint",
                required: true,
                index: true
            },

            apiId: {
                type: Schema.Types.ObjectId,
                ref: "API",
                required: true
            },

            apiVersionId: {
                type: Schema.Types.ObjectId,
                ref: "APIVersion",
                required: true
            },

            projectId: {
                type: Schema.Types.ObjectId,
                ref: "Project",
                required: true
            },

            organizationId: {
                type: Schema.Types.ObjectId,
                ref: "Organization",
                required: true
            },

            statusCode: {
                type: Number,
                required: true,
                min: 200,
                max: 599,
                validate: {
                    validator: Number.isInteger,
                    message: "Status code must be an integer"
                }
            },

            description: {
                type: String,
                trim: true,
                maxlength: 500
            },

            contentType: {
                type: String,
                enum: ["application/json"],
                required: false
            },

            modelId: {
                type: Schema.Types.ObjectId,
                ref: "APIModel",
                required: false
            },

            createdBy: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true
            }
        },
        {
            timestamps: true
        }
    );

// Prevent duplicate status codes per endpoint.
apiEndpointResponseSchema.index(
    {
        endpointId: 1,
        statusCode: 1
    },
    {
        unique: true
    }
);

apiEndpointResponseSchema.index({
    organizationId: 1,
    projectId: 1,
    apiId: 1,
    apiVersionId: 1
});

const APIEndpointResponse =
    mongoose.model<IAPIEndpointResponse>(
        "APIEndpointResponse",
        apiEndpointResponseSchema
    );

export default APIEndpointResponse;
