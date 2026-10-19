import mongoose from "mongoose";
import APIEndpoint, {
  HTTPMethod
} from "../models/APIEndpoint.js";

import {
  assertDraftAPIVersion,
  withDraftVersionTransaction
} from "./api-version-guard.service.js";

import API from "../models/API.js";
import APIVersion from "../models/APIVersion.js";
import { hasRouteConflict } from "../runtime/utils/route-conflict.js";

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
  await assertDraftAPIVersion({
    organizationId,
    projectId,
    apiId,
    apiVersionId
  });

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

  const normalizedPath = normalizePath(path);

  return withDraftVersionTransaction(
    {
      organizationId,
      projectId,
      apiId,
      apiVersionId
    },
    async (session) => {
      // Verify API belongs to project and organization
      const api = await API.findOne({
        _id: apiId,
        projectId,
        organizationId
      }).session(session);

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
        }).session(session);

      if (!apiVersion) {
        throw new Error(
          "API version not found"
        );
      }

      // -------------------------------------
      // Check duplicate and conflicting routes
      // within the same API version
      // -------------------------------------

      const existingEndpoints = await APIEndpoint.collection
        .find(
          {
            apiVersionId: new mongoose.Types.ObjectId(apiVersionId),
            organizationId: new mongoose.Types.ObjectId(organizationId),
            projectId: new mongoose.Types.ObjectId(projectId),
            apiId: new mongoose.Types.ObjectId(apiId),
            status: { $ne: "archived" }
          },
          { session }
        )
        .toArray();

      const conflictingEndpoint = existingEndpoints.find((existing) =>
        hasRouteConflict(
          {
            method: existing.method,
            path: existing.path
          },
          {
            method,
            path: normalizedPath
          }
        )
      );

      if (conflictingEndpoint) {
        throw new Error(
          `Route conflict: ${method} ${normalizedPath} conflicts with existing endpoint ${conflictingEndpoint.method} ${conflictingEndpoint.path}`
        );
      }

      const [endpoint] = await APIEndpoint.create(
        [
          {
            apiId,
            apiVersionId,
            projectId,
            organizationId,
            name: trimmedName,
            description: description?.trim(),
            method,
            path: normalizedPath,
            status: "draft",
            createdBy: userId
          }
        ],
        { session }
      );

      return endpoint;
    }
  );
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
  await assertDraftAPIVersion({
    organizationId,
    projectId,
    apiId,
    apiVersionId
  });
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

  return withDraftVersionTransaction(
    {
      organizationId,
      projectId,
      apiId,
      apiVersionId
    },
    async (session) => {
      const endpoint =
        await APIEndpoint.findOne({
          _id: endpointId,
          apiId,
          apiVersionId,
          projectId,
          organizationId
        }).session(session);

      if (!endpoint) {
        throw new Error(
          "API endpoint not found"
        );
      }

      // -----------------------------
      // Check duplicate method + path
      // -----------------------------

      const finalMethod = method ?? endpoint.method;

      const finalPath = normalizedPath ?? endpoint.path;

      const existingEndpoints = await APIEndpoint.collection
        .find(
          {
            apiVersionId: new mongoose.Types.ObjectId(apiVersionId),
            organizationId: new mongoose.Types.ObjectId(organizationId),
            projectId: new mongoose.Types.ObjectId(projectId),
            apiId: new mongoose.Types.ObjectId(apiId),
            _id: {
              $ne: new mongoose.Types.ObjectId(endpointId)
            },
            status: { $ne: "archived" }
          },
          { session }
        )
        .toArray();

      const conflictingEndpoint = existingEndpoints.find((existing) =>
        hasRouteConflict(
          {
            method: existing.method,
            path: existing.path
          },
          {
            method: finalMethod,
            path: finalPath
          }
        )
      );

      if (conflictingEndpoint) {
        throw new Error(
          `Route conflict: ${finalMethod} ${finalPath} conflicts with existing endpoint ${conflictingEndpoint.method} ${conflictingEndpoint.path}`
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
          runValidators: true,
          session
        }
      );
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
  return withDraftVersionTransaction(
    {
      organizationId,
      projectId,
      apiId,
      apiVersionId
    },
    async (session) => {
      const endpoint = await APIEndpoint.findOneAndUpdate(
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
          runValidators: true,
          session
        }
      );

      if (!endpoint) {
        throw new Error(
          "API endpoint not found or already archived"
        );
      }

      return endpoint;
    }
  );
};
