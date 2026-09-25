import Project from "../models/Project.js";

interface CreateProjectInput {
  name: string;
  description?: string;
  organizationId: string;
  userId: string;
}

interface UpdateProjectInput {
  projectId: string;
  organizationId: string;
  name?: string;
  description?: string;
}


const createSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const createProject = async ({
  name,
  description,
  organizationId,
  userId
}: CreateProjectInput) => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("Project name is required");
  }

  let slug = createSlug(trimmedName);

  if (!slug) {
    throw new Error("Invalid project name");
  }

  const existingProject = await Project.findOne({
    organizationId,
    slug
  });

  if (existingProject) {
    slug = `${slug}-${Date.now()}`;
  }

  const project = await Project.create({
    name: trimmedName,
    slug,
    description: description?.trim(),
    organizationId,
    createdBy: userId
  });

  return project;
};

export const getOrganizationProjects = async (
  organizationId: string
) => {
  return Project.find({
    organizationId
  })
    .sort({ createdAt: -1 })
    .select(
      "_id name slug description organizationId createdBy status createdAt updatedAt"
    );
};

export const getProjectById = async (
  projectId: string,
  organizationId: string
) => {
  return Project.findOne({
    _id: projectId,
    organizationId
  });
};

export const updateProject = async ({
  projectId,
  organizationId,
  name,
  description
}: UpdateProjectInput) => {
  const updateData: {
    name?: string;
    slug?: string;
    description?: string;
  } = {};

  if (name !== undefined) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error("Project name cannot be empty");
    }

    if (trimmedName.length < 2) {
      throw new Error(
        "Project name must be at least 2 characters"
      );
    }

    if (trimmedName.length > 100) {
      throw new Error(
        "Project name cannot exceed 100 characters"
      );
    }

    const slug = createSlug(trimmedName);

    if (!slug) {
      throw new Error("Invalid project name");
    }

    const existingProject = await Project.findOne({
      organizationId,
      slug,
      _id: { $ne: projectId }
    });

    if (existingProject) {
      throw new Error(
        "A project with this name already exists"
      );
    }

    updateData.name = trimmedName;
    updateData.slug = slug;
  }

  if (description !== undefined) {
    const trimmedDescription = description.trim();

    if (trimmedDescription.length > 500) {
      throw new Error(
        "Project description cannot exceed 500 characters"
      );
    }

    updateData.description = trimmedDescription;
  }

  return Project.findOneAndUpdate(
    {
      _id: projectId,
      organizationId
    },
    {
      $set: updateData
    },
    {
      new: true,
      runValidators: true
    }
  );
};

export const archiveProject = async (
  projectId: string,
  organizationId: string
) => {
  return Project.findOneAndUpdate(
    {
      _id: projectId,
      organizationId,
      status: "active"
    },
    {
      $set: {
        status: "archived"
      }
    },
    {
      new: true
    }
  );
};