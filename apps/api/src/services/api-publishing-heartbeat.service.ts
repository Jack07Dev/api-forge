import APIVersion from "../models/APIVersion.js";
import type { PublishAPIVersionInput } from "./api-publishing.service.js";

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export const renewPublishingLock = async (
    input: PublishAPIVersionInput & {
        publishingToken: string;
        definitionRevision: number;
    }
): Promise<boolean> => {
    const cutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);

    const result = await APIVersion.updateOne(
        {
            _id: input.versionId,
            organizationId: input.organizationId,
            projectId: input.projectId,
            apiId: input.apiId,
            status: "publishing",
            publishingToken: input.publishingToken,
            definitionRevision: input.definitionRevision,
            publishingStartedAt: { $gte: cutoff },
        },
        {
            $set: {
                publishingStartedAt: new Date(),
            },
        }
    );

    return result.matchedCount === 1;
};