import mongoose, { Document, Schema } from "mongoose";

export type APIVersionStatus =
    | "draft"
    | "active"
    | "deprecated"
    | "archived";

export interface IAPIVersion extends Document {
    apiId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    version: number;
    versionLabel: string;
    basePath?: string;
    description?: string;
    status: APIVersionStatus;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const apiVersionSchema = new Schema<IAPIVersion>(
    {
        apiId: {
            type: Schema.Types.ObjectId,
            ref: "API",
            required: true
        },
        projectId: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true,
            index: true
        },

        organizationId: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            index: true
        },

        version: {
            type: Number,
            required: true,
            min: 1
        },

        versionLabel: {
            type: String,
            required: true,
            trim: true
        },

        basePath: {
            type: String,
            trim: true,
            maxlength: 200
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500
        },

        status: {
            type: String,
            enum: [
                "draft",
                "active",
                "deprecated",
                "archived"
            ],
            default: "draft",
            index: true
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        }
    },
    {
        timestamps: true
    }
);

apiVersionSchema.index(
    {
        apiId: 1,
        version: 1
    },
    {
        unique: true
    }
);

apiVersionSchema.index({
    organizationId: 1,
    projectId: 1,
    apiId: 1
});

apiVersionSchema.index(
    {
        apiId: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: "active"
        }
    }
);

const APIVersion = mongoose.model<IAPIVersion>(
    "APIVersion",
    apiVersionSchema
);

export default APIVersion;