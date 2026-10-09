
import mongoose, { Document, Schema } from "mongoose";

export interface IAPIEndpointRequestBody extends Document {
  endpointId: mongoose.Types.ObjectId;
  apiId: mongoose.Types.ObjectId;
  apiVersionId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  contentType: string;
  required: boolean;
  modelId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const requestBodySchema = new Schema<IAPIEndpointRequestBody>(
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
    contentType: {
      type: String,
      enum: ["application/json"],
      required: true
    },
    required: {
      type: Boolean,
      default: true
    },
    modelId: {
      type: Schema.Types.ObjectId,
      ref: "APIModel",
      required: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

// One request-body configuration per endpoint for this MVP.
requestBodySchema.index(
  { endpointId: 1 },
  { unique: true }
);

const APIEndpointRequestBody =
  mongoose.model<IAPIEndpointRequestBody>(
    "APIEndpointRequestBody",
    requestBodySchema
  );

export default APIEndpointRequestBody;
