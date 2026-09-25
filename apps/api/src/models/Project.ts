import mongoose, { Document, Schema } from "mongoose";

export type ProjectStatus =
  | "active"
  | "archived";

export interface IProject extends Document {
  name: string;
  slug: string;
  description?: string;
  organizationId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
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

    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
      index: true
    }
  },
  {
    timestamps: true
  }
);

projectSchema.index({
  organizationId: 1,
  slug: 1
});

const Project = mongoose.model<IProject>(
  "Project",
  projectSchema
);

export default Project;