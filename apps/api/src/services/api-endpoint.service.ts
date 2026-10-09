import APIEndpoint, {
  HTTPMethod
} from "../models/APIEndpoint.js";

import API from "../models/API.js";
import APIVersion from "../models/APIVersion.js";

interface CreateAPIEndpointInput {
  name: string;
  description?: string;
  method: HTTPMethod;
  path: string;

  apiId: string;
  apiVersionId: string;
  projectId: string;
  organizationId: string;

  userId: string;
}

interface UpdateAPIEndpointInput {
  endpointId: string;

  apiId: string;
  apiVersionId: string;
  projectId: string;
  organizationId: string;

  name?: string;
  description?: string;
  method?: HTTPMethod;
  path?: string;
}

const normalizePath = (path: string): string => {
  const trimmedPath = path.trim();

  if (!trimmedPath.startsWith("/")) {
    throw new Error(
      "Endpoint path must start with /"
    );
  }

  if (trimmedPath.length > 200) {
    throw new Error(
      "Endpoint path cannot exceed 200 characters"
    );
  }

  if (trimmedPath.includes(" ")) {
    throw new Error(
      "Endpoint path cannot contain spaces"
    );
  }

  if (trimmedPath.includes("//")) {
    throw new Error(
      "Endpoint path cannot contain consecutive slashes"
    );
  }

  if (
    !/^\/[a-zA-Z0-9._~!$&'()*+,;=:@%\/{}-]*$/.test(
      trimmedPath
    )
  ) {
    throw new Error(
      "Endpoint path contains invalid characters"
    );
  }

  if (trimmedPath.length > 1) {
    return trimmedPath.replace(/\/+$/, "");
  }

  return trimmedPath;
};

export const createAPIEndpoint = async ({
  name,
  description,
  method,
  path,
  apiId,
  apiVersionId,
  projectId,
  organizationId,
  userId
}: CreateAPIEndpointInput) => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error(
      "Endpoint name is required"
    );
  }

  if (trimmedName.length < 2) {
    throw new Error(
      "Endpoint name must be at least 2 characters"
    );
  }

  if (trimmedName.length > 100) {
    throw new Error(
      "Endpoint name cannot exceed 100 characters"
    );
  }

  const allowedMethods: HTTPMethod[] = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE"
  ];

  if (!allowedMethods.includes(method)) {
    throw new Error(
      "Invalid HTTP method"
    );
  }

  const normalizedPath =
    normalizePath(path);

  // Verify API belongs to project and organization
  const api = await API.findOne({
    _id: apiId,
    projectId,
    organizationId
  });

  if (!api) {
    throw new Error("API not found");
  }

  // Verify version belongs to API,
  // project and organization
  const apiVersion =
    await APIVersion.findOne({
      _id: apiVersionId,
      apiId,
      projectId,
      organizationId
    });

  if (!apiVersion) {
    throw new Error(
      "API version not found"
    );
  }

  // Prevent duplicate method + path
  // inside the same API version
  const existingEndpoint =
    await APIEndpoint.findOne({
      apiVersionId,
      method,
      path: normalizedPath
    });

  if (existingEndpoint) {
    throw new Error(
      `An endpoint already exists for ${method} ${normalizedPath}`
    );
  }

  const endpoint =
    await APIEndpoint.create({
      apiId,
      apiVersionId,
      projectId,
      organizationId,
      name: trimmedName,
      description:
        description?.trim(),
      method,
      path: normalizedPath,
      status: "draft",
      createdBy: userId
    });

  return endpoint;
};

export const getAPIEndpoints = async (
  apiId: string,
  apiVersionId: string,
  projectId: string,
  organizationId: string
) => {
  return APIEndpoint.find({
    apiId,
    apiVersionId,
    projectId,
    organizationId
  })
    .sort({ createdAt: -1 })
    .select(
      "_id apiId apiVersionId projectId organizationId name description method path status createdBy createdAt updatedAt"
    );
};

export const getAPIEndpointById = async (
  endpointId: string,
  apiId: string,
  apiVersionId: string,
  projectId: string,
  organizationId: string
) => {
  return APIEndpoint.findOne({
    _id: endpointId,
    apiId,
    apiVersionId,
    projectId,
    organizationId
  });
};

export const updateAPIEndpoint = async ({
  endpointId,
  apiId,
  apiVersionId,
  projectId,
  organizationId,
  name,
  description,
  method,
  path
}: UpdateAPIEndpointInput) => {
  const updateData: {
    name?: string;
    description?: string;
    method?: HTTPMethod;
    path?: string;
  } = {};

  // -----------------------------
  // Validate name
  // -----------------------------

  if (name !== undefined) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error(
        "Endpoint name cannot be empty"
      );
    }

    if (trimmedName.length < 2) {
      throw new Error(
        "Endpoint name must be at least 2 characters"
      );
    }

    if (trimmedName.length > 100) {
      throw new Error(
        "Endpoint name cannot exceed 100 characters"
      );
    }

    updateData.name = trimmedName;
  }

  // -----------------------------
  // Validate description
  // -----------------------------

  if (description !== undefined) {
    const trimmedDescription =
      description.trim();

    if (trimmedDescription.length > 500) {
      throw new Error(
        "Endpoint description cannot exceed 500 characters"
      );
    }

    updateData.description =
      trimmedDescription;
  }

  // -----------------------------
  // Validate method
  // -----------------------------

  const allowedMethods: HTTPMethod[] = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE"
  ];

  if (method !== undefined) {
    if (!allowedMethods.includes(method)) {
      throw new Error(
        "Invalid HTTP method"
      );
    }

    updateData.method = method;
  }

  // -----------------------------
  // Validate path
  // -----------------------------

  let normalizedPath: string | undefined;

  if (path !== undefined) {
    normalizedPath = normalizePath(path);
    updateData.path = normalizedPath;
  }

  // -----------------------------
  // Verify endpoint
  // -----------------------------

  const endpoint =
    await APIEndpoint.findOne({
      _id: endpointId,
      apiId,
      apiVersionId,
      projectId,
      organizationId
    });

  if (!endpoint) {
    throw new Error(
      "API endpoint not found"
    );
  }

  // -----------------------------
  // Check duplicate method + path
  // -----------------------------

  const finalMethod =
    method ?? endpoint.method;

  const finalPath =
    normalizedPath ?? endpoint.path;

  const existingEndpoint =
    await APIEndpoint.findOne({
      apiVersionId,
      method: finalMethod,
      path: finalPath,
      _id: {
        $ne: endpointId
      }
    });

  if (existingEndpoint) {
    throw new Error(
      `An endpoint already exists for ${finalMethod} ${finalPath}`
    );
  }

  // -----------------------------
  // Update endpoint
  // -----------------------------

  return APIEndpoint.findOneAndUpdate(
    {
      _id: endpointId,
      apiId,
      apiVersionId,
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

export const archiveAPIEndpoint = async (
  endpointId: string,
  apiId: string,
  apiVersionId: string,
  projectId: string,
  organizationId: string
) => {
  return APIEndpoint.findOneAndUpdate(
    {
      _id: endpointId,
      apiId,
      apiVersionId,
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
      new: true,
      runValidators: true
    }
  );
};