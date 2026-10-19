import APIVersion from "../models/APIVersion.js";
import { recoverStalePublishingLock } from "../services/api-publishing.service.js";

const RECOVERY_INTERVAL_MS = 60 * 1000;

let recoveryTimer: NodeJS.Timeout | undefined;
let recoveryRunning = false;

export const runPublishingLockRecovery = async (): Promise<void> => {
    if (recoveryRunning) return;

    recoveryRunning = true;

    console.log(
        "🔄 Recovery worker running at:",
        new Date().toLocaleTimeString()
    );

    try {
        const cutoff = new Date(Date.now() - 10 * 60 * 1000);

        const staleVersions = await APIVersion.find({
            status: "publishing",
            publishingStartedAt: { $lt: cutoff },
            publishingToken: { $type: "string" },
        })
            .select("_id organizationId projectId apiId")
            .lean();

        for (const version of staleVersions) {
            try {
                const result = await recoverStalePublishingLock({
                    organizationId: String(version.organizationId),
                    projectId: String(version.projectId),
                    apiId: String(version.apiId),
                    versionId: String(version._id),
                });

                if (result.recovered) {
                    console.log(
                        "Recovered stale publishing lock:",
                        String(version._id)
                    );
                }
            } catch (error) {
                console.error(
                    "Failed to recover publishing lock:",
                    String(version._id),
                    error
                );
            }
        }
    } catch (error) {
        console.error("Publishing lock recovery scan failed:", error);
    } finally {
        recoveryRunning = false;
        console.log("✅ Recovery worker scan completed");
    }
};

export const startPublishingLockRecoveryWorker = (): void => {
    if (recoveryTimer) return;

    recoveryTimer = setInterval(() => {
        void runPublishingLockRecovery();
    }, RECOVERY_INTERVAL_MS);

    recoveryTimer.unref?.();

    console.log("Publishing lock recovery worker started");
};

export const stopPublishingLockRecoveryWorker = (): void => {
    if (!recoveryTimer) return;

    clearInterval(recoveryTimer);
    recoveryTimer = undefined;

    console.log("Publishing lock recovery worker stopped");
};