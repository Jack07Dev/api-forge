import mongoose, { Schema, Document } from "mongoose";

export type EndpointSecurityType = "none" | "apiKey" | "bearer";

export interface IAPIEndpointSecurity extends Document {
  endpointId: mongoose.Types.ObjectId;
  apiId: mongoose.Types.ObjectId;
  apiVersionId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;

  type: EndpointSecurityType;

  apiKey?: {
    name: string;
    in: "header";
  };

  bearer?: {
    bearerFormat?: string;
  };

  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const apiEndpointSecuritySchema = new Schema<IAPIEndpointSecurity>(
  {
    endpointId: {
      type: Schema.Types.ObjectId,
      ref: "APIEndpoint",
      required: true,
    },

    apiId: {
      type: Schema.Types.ObjectId,
      ref: "API",
      required: true,
    },

    apiVersionId: {
      type: Schema.Types.ObjectId,
      ref: "APIVersion",
      required: true,
    },

    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    type: {
      type: String,
      enum: ["none", "apiKey", "bearer"],
      required: true,
    },

    apiKey: {
      type: new Schema(
        {
          name: {
            type: String,
            required: true,
            trim: true,
          },
          in: {
            type: String,
            enum: ["header"],
            required: true,
          },
        },
        { _id: false },
      ),
      default: undefined,
    },

    bearer: {
      type: new Schema(
        {
          bearerFormat: {
            type: String,
            trim: true,
          },
        },
        { _id: false },
      ),
      default: undefined,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Only one security configuration per endpoint
apiEndpointSecuritySchema.index(
  { endpointId: 1 },
  { unique: true },
);

const APIEndpointSecurity = mongoose.model<IAPIEndpointSecurity>(
  "APIEndpointSecurity",
  apiEndpointSecuritySchema,
);

export default APIEndpointSecurity;