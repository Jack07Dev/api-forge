import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";

interface CreateOrganizationInput {
  name: string;
  userId: string;
}

const createSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const createOrganization = async ({
  name,
  userId
}: CreateOrganizationInput) => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Organization name is required");
  }

  let slug = createSlug(trimmedName);

  if (!slug) {
    throw new Error("Invalid organization name");
  }

  const existingOrganization = await Organization.findOne({
    slug
  });

  if (existingOrganization) {
    slug = `${slug}-${Date.now()}`;
  }

  const organization = await Organization.create({
    name: trimmedName,
    slug,
    ownerId: userId
  });

  await OrganizationMember.create({
    organizationId: organization._id,
    userId,
    role: "owner"
  });

  return organization;
};

export const getUserOrganizations = async (
  userId: string
) => {
  const memberships = await OrganizationMember.find({
    userId
  })
    .populate("organizationId")
    .sort({ createdAt: -1 });

  return memberships;
};

export const getOrganizationById = async (
  organizationId: string,
  userId: string
) => {
  const membership =
    await OrganizationMember.findOne({
      organizationId,
      userId
    });

  if (!membership) {
    return null;
  }

  return Organization.findOne({
    _id: organizationId,
    isActive: true
  });
};

export const archiveOrganization = async (
  organizationId: string,
  userId: string
) => {
  const membership =
    await OrganizationMember.findOne({
      organizationId,
      userId
    });

  if (!membership) {
    throw new Error(
      "You are not a member of this organization"
    );
  }

  if (membership.role !== "owner") {
    throw new Error(
      "Only the organization owner can archive the organization"
    );
  }

  const organization =
    await Organization.findOne({
      _id: organizationId,
      isActive: true
    });

  if (!organization) {
    throw new Error(
      "Organization not found or already archived"
    );
  }

  organization.isActive = false;

  await organization.save();

  return organization;
};
