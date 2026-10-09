import mongoose, {
  Document,
  Schema
} from "mongoose";

export type EndpointParameterLocation =
  | "path"
  | "query"
  | "header";

export type EndpointParameterDataType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "objectId";

export interface IAPIEndpointParameter
  extends Document {
  endpointId: mongoose.Types.ObjectId;

  apiId: mongoose.Types.ObjectId;
  apiVersionId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;

  name: string;

  location: EndpointParameterLocation;

  dataType: EndpointParameterDataType;

  required: boolean;

  description?: string;

  defaultValue?: unknown;

  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const apiEndpointParameterSchema =
  new Schema<IAPIEndpointParameter>(
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
        maxlength: 100
      },

      location: {
        type: String,
        enum: [
          "path",
          "query",
          "header"
        ],
        required: true
      },

      dataType: {
        type: String,
        enum: [
          "string",
          "number",
          "boolean",
          "date",
          "objectId"
        ],
        required: true
      },

      required: {
        type: Boolean,
        default: false
      },

      description: {
        type: String,
        trim: true,
        maxlength: 500
      },

      defaultValue: {
        type: Schema.Types.Mixed
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

apiEndpointParameterSchema.index({
  endpointId: 1,
  location: 1,
  name: 1
});

apiEndpointParameterSchema.index({
  organizationId: 1,
  projectId: 1,
  apiId: 1,
  apiVersionId: 1,
  endpointId: 1
});

const APIEndpointParameter =
  mongoose.model<IAPIEndpointParameter>(
    "APIEndpointParameter",
    apiEndpointParameterSchema
  );

export default APIEndpointParameter;