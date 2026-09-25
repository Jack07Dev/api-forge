import mongoose, { Document, Schema } from "mongoose";

export type OrganizationRole =
  | "owner"
  | "admin"
  | "developer"
  | "viewer";

export interface IOrganizationMember extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
}

const organizationMemberSchema =
  new Schema<IOrganizationMember>(
    {
      organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
        index: true
      },

      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
      },

      role: {
        type: String,
        enum: [
          "owner",
          "admin",
          "developer",
          "viewer"
        ],
        default: "viewer"
      }
    },
    {
      timestamps: true
    }
  );

organizationMemberSchema.index(
  {
    organizationId: 1,
    userId: 1
  },
  {
    unique: true
  }
);

const OrganizationMember =
  mongoose.model<IOrganizationMember>(
    "OrganizationMember",
    organizationMemberSchema
  );

export default OrganizationMember;