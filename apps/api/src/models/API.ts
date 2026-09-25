import mongoose, { Document, Schema } from "mongoose";

export type APIStatus =
    | "draft"
    | "active"
    | "deprecated"
    | "archived";

export interface IAPI extends Document {
    name: string;
    slug: string;
    description?: string;

    projectId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;

    status: APIStatus;

    createdBy: mongoose.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

const apiSchema = new Schema<IAPI>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100
        },

        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500
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

apiSchema.index({
    organizationId: 1,
    projectId: 1
});

apiSchema.index({
    projectId: 1,
    slug: 1
});

const API = mongoose.model<IAPI>(
    "API",
    apiSchema
);

export default API;