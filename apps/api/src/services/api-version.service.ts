import APIVersion from "../models/APIVersion.js";
import API from "../models/API.js";

interface CreateAPIVersionInput {
  apiId: string;
  projectId: string;
  organizationId: string;
  userId: string;
}

export const createAPIVersion = async ({
  apiId,
  projectId,
  organizationId,
  userId
}: CreateAPIVersionInput) => {
  // Verify API belongs to the correct project and organization
  const api = await API.findOne({
    _id: apiId,
    projectId,
    organizationId
  });

  if (!api) {
    throw new Error("API not found");
  }

  // Find the latest version
  const latestVersion = await APIVersion.findOne({
    apiId,
    projectId,
    organizationId
  }).sort({ version: -1 });

  const nextVersion = latestVersion
    ? latestVersion.version + 1
    : 1;

  const versionLabel = `v${nextVersion}`;

  const apiVersion = await APIVersion.create({
    apiId,
    projectId,
    organizationId,
    version: nextVersion,
    versionLabel,
    status: "draft",
    createdBy: userId
  });

  return apiVersion;
};

export const getAPIVersions = async (
  apiId: string,
  projectId: string,
  organizationId: string
) => {
  return APIVersion.find({
    apiId,
    projectId,
    organizationId
  })
    .sort({ version: 1 })
    .select(
      "_id apiId projectId organizationId version versionLabel status createdBy createdAt updatedAt"
    );
};

export const getAPIVersionById = async (
  versionId: string,
  apiId: string,
  projectId: string,
  organizationId: string
) => {
  return APIVersion.findOne({
    _id: versionId,
    apiId,
    projectId,
    organizationId
  });
};