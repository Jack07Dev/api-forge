import mongoose, {
  Document,
  Schema
} from "mongoose";

export type HTTPMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

export type APIEndpointStatus =
  | "draft"
  | "active"
  | "deprecated"
  | "archived";

export interface IAPIEndpoint
  extends Document {
  apiId: mongoose.Types.ObjectId;
  apiVersionId: mongoose.Types.ObjectId;

  projectId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;

  name: string;
  description?: string;

  method: HTTPMethod;
  path: string;

  status: APIEndpointStatus;

  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const apiEndpointSchema =
  new Schema<IAPIEndpoint>(
    {
      apiId: {
        type: Schema.Types.ObjectId,
        ref: "API",
        required: true,
        index: true
      },

      apiVersionId: {
        type: Schema.Types.ObjectId,
        ref: "APIVersion",
        required: true,
        index: true
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

      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
      },

      description: {
        type: String,
        trim: true,
        maxlength: 500
      },

      method: {
        type: String,
        enum: [
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE"
        ],
        required: true
      },

      path: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
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

apiEndpointSchema.index({
  apiVersionId: 1,
  method: 1,
  path: 1
});

apiEndpointSchema.index({
  organizationId: 1,
  projectId: 1,
  apiId: 1,
  apiVersionId: 1
});

const APIEndpoint =
  mongoose.model<IAPIEndpoint>(
    "APIEndpoint",
    apiEndpointSchema
  );

export default APIEndpoint;