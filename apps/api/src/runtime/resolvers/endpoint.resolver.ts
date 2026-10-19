import mongoose from "mongoose";

import APIEndpoint, {
    type IAPIEndpoint
} from "../../models/APIEndpoint.js";
import APIVersion from "../../models/APIVersion.js";

type ResolverInput = {
    organizationId: string;
    projectId: string;
    apiId: string;
    versionId: string;
    method: string;
    path: string;
};

type EndpointRecord = {
    _id: mongoose.Types.ObjectId;
    name: string;
    method: string;
    path: string;
    status: string;
};

export const resolveEndpoint = async ({
    organizationId,
    projectId,
    apiId,
    versionId,
    method,
    path
}: ResolverInput) => {
    const ids = [
        organizationId,
        projectId,
        apiId,
        versionId
    ];

    if (!ids.every(mongoose.isValidObjectId)) {
        throw new Error("Invalid API identifiers");
    }

    const version = await APIVersion.findOne({
        _id: versionId,
        organizationId,
        projectId,
        apiId,
        status: { $ne: "archived" }
    });

    if (!version) {
        return null;
    }

    const endpoints = await APIEndpoint.collection
        .find({
            organizationId: new mongoose.Types.ObjectId(organizationId),
            projectId: new mongoose.Types.ObjectId(projectId),
            apiId: new mongoose.Types.ObjectId(apiId),
            apiVersionId: new mongoose.Types.ObjectId(versionId),
            method: method.toUpperCase(),
            status: { $ne: "archived" }
        })
        .toArray() as EndpointRecord[];

    const normalizedPath =
        "/" + path.split("/").filter(Boolean).join("/");

    for (const endpoint of endpoints) {
        const parameterNames: string[] = [];

        const pattern = endpoint.path
            .split("/")
            .filter(Boolean)
            .map((segment: string) => {
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

        if (!match) continue;

        const params: Record<string, string> = {};

        parameterNames.forEach((name, index) => {
            params[name] = decodeURIComponent(match[index + 1]);
        });

        return {
            endpointId: String(endpoint._id),
            endpointName: endpoint.name,
            method: endpoint.method,
            path: endpoint.path,
            status: endpoint.status,
            params,
            versionId: String(version._id),
            versionLabel: version.versionLabel
        };
    }

    return null;
};