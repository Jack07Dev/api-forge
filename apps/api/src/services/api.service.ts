import API from "../models/API.js";
import Project from "../models/Project.js";

interface CreateAPIInput {
    name: string;
    description?: string;
    projectId: string;
    organizationId: string;
    userId: string;
}

interface UpdateAPIInput {
    apiId: string;
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

export const createAPI = async ({
    name,
    description,
    projectId,
    organizationId,
    userId
}: CreateAPIInput) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
        throw new Error("API name is required");
    }

    if (trimmedName.length < 2) {
        throw new Error(
            "API name must be at least 2 characters"
        );
    }

    if (trimmedName.length > 100) {
        throw new Error(
            "API name cannot exceed 100 characters"
        );
    }

    // Verify project belongs to the organization
    const project = await Project.findOne({
        _id: projectId,
        organizationId,
        status: "active"
    });

    if (!project) {
        throw new Error(
            "Project not found or is not active"
        );
    }

    const slug = createSlug(trimmedName);

    if (!slug) {
        throw new Error("Invalid API name");
    }

    // Prevent duplicate API names within the same project
    const existingAPI = await API.findOne({
        projectId,
        slug
    });

    if (existingAPI) {
        throw new Error(
            "An API with this name already exists in this project"
        );
    }

    const api = await API.create({
        name: trimmedName,
        slug,
        description: description?.trim(),
        projectId,
        organizationId,
        createdBy: userId,
        status: "draft"
    });

    return api;
};

export const getProjectAPIs = async (
    projectId: string,
    organizationId: string
) => {
    return API.find({
        projectId,
        organizationId
    })
        .sort({ createdAt: -1 })
        .select(
            "_id name slug description projectId organizationId status createdBy createdAt updatedAt"
        );
};

export const getAPIById = async (
    apiId: string,
    projectId: string,
    organizationId: string
) => {
    return API.findOne({
        _id: apiId,
        projectId,
        organizationId
    });
};

export const updateAPI = async ({
    apiId,
    projectId,
    organizationId,
    name,
    description
}: UpdateAPIInput) => {
    const updateData: {
        name?: string;
        slug?: string;
        description?: string;
    } = {};

    if (name !== undefined) {
        const trimmedName = name.trim();

        if (!trimmedName) {
            throw new Error("API name cannot be empty");
        }

        if (trimmedName.length < 2) {
            throw new Error(
                "API name must be at least 2 characters"
            );
        }

        if (trimmedName.length > 100) {
            throw new Error(
                "API name cannot exceed 100 characters"
            );
        }

        const slug = createSlug(trimmedName);

        if (!slug) {
            throw new Error("Invalid API name");
        }

        const existingAPI = await API.findOne({
            projectId,
            slug,
            _id: { $ne: apiId }
        });

        if (existingAPI) {
            throw new Error(
                "An API with this name already exists in this project"
            );
        }

        updateData.name = trimmedName;
        updateData.slug = slug;
    }

    if (description !== undefined) {
        const trimmedDescription = description.trim();

        if (trimmedDescription.length > 500) {
            throw new Error(
                "API description cannot exceed 500 characters"
            );
        }

        updateData.description = trimmedDescription;
    }

    return API.findOneAndUpdate(
        {
            _id: apiId,
            projectId,
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

export const archiveAPI = async (
  apiId: string,
  projectId: string,
  organizationId: string
) => {
  return API.findOneAndUpdate(
    {
      _id: apiId,
      projectId,
      organizationId,
      status: {
        $ne: "archived"
      }
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