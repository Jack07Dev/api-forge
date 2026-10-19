import mongoose from "mongoose";

import APIVersion from "../../models/APIVersion.js";
import APIEndpoint, {
    type HTTPMethod,
} from "../../models/APIEndpoint.js";
interface ResolveActiveEndpointInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    method: HTTPMethod;
    path: string;
}

const ALLOWED_METHODS = new Set([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
]);

export const resolveActiveEndpoint = async ({
    organizationId,
    projectId,
    apiId,
    method,
    path,
}: ResolveActiveEndpointInput) => {
    const ids = [organizationId, projectId, apiId];

    if (!ids.every((id) => mongoose.isValidObjectId(id))) {
        throw new Error("INVALID_API_IDENTIFIERS");
    }

    const normalizedMethod = method.toUpperCase();

    if (!ALLOWED_METHODS.has(normalizedMethod)) {
        throw new Error("INVALID_HTTP_METHOD");
    }

    const validatedMethod = normalizedMethod as HTTPMethod;

    if (
        !path.startsWith("/") ||
        path.includes("?") ||
        path.includes("#") ||
        path.includes("//")
    ) {
        throw new Error("INVALID_ENDPOINT_PATH");
    }

    const normalizedPath =
        "/" + path.split("/").filter(Boolean).join("/");

    // Only the active published version is eligible.
    const activeVersion = await APIVersion.findOne({
        organizationId,
        projectId,
        apiId,
        status: "active",
    }).lean();

    if (!activeVersion) {
        return null;
    }

    const endpoints = await APIEndpoint.find({
        organizationId,
        projectId,
        apiId,
        apiVersionId: activeVersion._id,
        method: validatedMethod,
        status: { $ne: "archived" },
    }).lean();

    // Static routes take priority over parameterized routes.
    const sortedEndpoints = [...endpoints].sort((a, b) => {
        const countParameters = (route: string) =>
            route.split("/").filter(
                (segment) =>
                    segment.startsWith("{") &&
                    segment.endsWith("}")
            ).length;

        return countParameters(a.path) - countParameters(b.path);
    });

    for (const endpoint of sortedEndpoints) {
        const parameterNames: string[] = [];

        const pattern = endpoint.path
            .split("/")
            .filter(Boolean)
            .map((segment) => {
                if (
                    segment.startsWith("{") &&
                    segment.endsWith("}")
                ) {
                    parameterNames.push(segment.slice(1, -1));
                    return "([^/]+)";
                }

                return segment.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );
            })
            .join("/");

        const regex = new RegExp(`^/${pattern}/?$`);

        const match = normalizedPath.match(regex);

        if (!match) {
            continue;
        }

        const params: Record<string, string> = {};

        try {
            parameterNames.forEach((name, index) => {
                params[name] = decodeURIComponent(
                    match[index + 1]
                );
            });
        } catch {
            throw new Error("INVALID_PATH_ENCODING");
        }

        return {
            endpointId: String(endpoint._id),
            endpointName: endpoint.name,
            method: endpoint.method,
            path: endpoint.path,
            params,
            versionId: String(activeVersion._id),
            versionLabel: activeVersion.versionLabel,
        };
    }

    return null;
};