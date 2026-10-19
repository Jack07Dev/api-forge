import mongoose, { type ClientSession } from "mongoose";
import APIVersion from "../models/APIVersion.js";

interface AssertDraftVersionInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
}

interface DraftMutationInput {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
}

export const assertDraftAPIVersion = async ({
    organizationId,
    projectId,
    apiId,
    apiVersionId
}: AssertDraftVersionInput): Promise<void> => {

    const version = await APIVersion.findOne({
        _id: apiVersionId,
        organizationId,
        projectId,
        apiId
    }).select("status");

    if (!version) {
        throw new Error("API version not found");
    }

    if (version.status !== "draft") {
        throw new Error(
            `Cannot modify API definitions when version status is ${version.status}`
        );
    }
};

export const withDraftVersionTransaction = async <T>(
    input: DraftMutationInput,
    mutation: (session: ClientSession) => Promise<T>
): Promise<T> => {
    return mongoose.connection.transaction(async (session) => {
        const version = await APIVersion.findOneAndUpdate(
            {
                _id: input.apiVersionId,
                organizationId: input.organizationId,
                projectId: input.projectId,
                apiId: input.apiId,
                status: "draft",
            },
            {
                $inc: {
                    definitionRevision: 1,
                },
            },
            {
                session,
                returnDocument: "after",
                runValidators: true,
            }
        );

        if (!version) {
            throw new Error(
                "API version not found or is not available for modification"
            );
        }

        return mutation(session);
    });
};