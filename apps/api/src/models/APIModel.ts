import mongoose, {
  Document,
  Schema
} from "mongoose";

export type APIModelStatus =
  | "draft"
  | "active"
  | "archived";

export type APIFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "objectId";

export interface IAPIModelField {
  name: string;
  type: APIFieldType;
  required: boolean;
  unique: boolean;
  description?: string;
}

export interface IAPIModel extends Document {
  name: string;
  slug: string;
  description?: string;

  apiId: mongoose.Types.ObjectId;
  versionId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;

  fields: IAPIModelField[];

  status: APIModelStatus;

  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const apiModelFieldSchema =
  new Schema<IAPIModelField>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100
      },

      type: {
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

      unique: {
        type: Boolean,
        default: false
      },

      description: {
        type: String,
        trim: true,
        maxlength: 500
      }
    },
    {
      _id: false
    }
  );

const apiModelSchema =
  new Schema<IAPIModel>(
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

      apiId: {
        type: Schema.Types.ObjectId,
        ref: "API",
        required: true,
        index: true
      },

      versionId: {
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

      fields: {
        type: [apiModelFieldSchema],
        default: []
      },

      status: {
        type: String,
        enum: [
          "draft",
          "active",
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

apiModelSchema.index(
  {
    versionId: 1,
    slug: 1
  },
  {
    unique: true
  }
);

apiModelSchema.index({
  organizationId: 1,
  projectId: 1,
  apiId: 1,
  versionId: 1
});

const APIModel = mongoose.model<IAPIModel>(
  "APIModel",
  apiModelSchema
);

export default APIModel;