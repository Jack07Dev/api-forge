
import mongoose, { Document, Schema } from "mongoose";

export interface IAPIDataRecord extends Document {
    organizationId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    apiId: mongoose.Types.ObjectId;
    apiVersionId: mongoose.Types.ObjectId;
    modelId: mongoose.Types.ObjectId;

    data: Record<string, unknown>;

    createdAt: Date;
    updatedAt: Date;
}

const apiDataRecordSchema = new Schema<IAPIDataRecord>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            immutable: true,
        },

        projectId: {
            type: Schema.Types.ObjectId,
            ref: "Project",
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

        modelId: {
            type: Schema.Types.ObjectId,
            ref: "APIModel",
            required: true,
            immutable: true,
        },

        data: {
            type: Schema.Types.Mixed,
            required: true,
        },
    },
    {
        timestamps: true,
        strict: "throw",
        collection: "apidatarecords",
    }
);

// Every CRUD query must use this scope.
apiDataRecordSchema.index({
    organizationId: 1,
    projectId: 1,
    apiId: 1,
    apiVersionId: 1,
    modelId: 1,
});

// Helps scoped record lookups and sorting.
apiDataRecordSchema.index({
    organizationId: 1,
    projectId: 1,
    apiId: 1,
    apiVersionId: 1,
    modelId: 1,
    createdAt: -1,
});

const APIDataRecord = mongoose.model<IAPIDataRecord>(
    "APIDataRecord",
    apiDataRecordSchema
);

export default APIDataRecord;
