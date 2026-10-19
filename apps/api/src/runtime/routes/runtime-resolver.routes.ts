import { Router } from "express";

import { testResolveEndpoint } from "../controllers/runtime-resolver.controller.js";
import { resolveActiveRuntime } from "../controllers/active-runtime.controller.js";
import { executeMockRuntime } from "../controllers/mock-execution.controller.js";
import { executeDataRuntime } from "../controllers/data-execution.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requireOrganizationMember } from "../../middlewares/organization.middleware.js";
import { requireDataRuntimeAccess } from "../middlewares/data-runtime-access.middleware.js";

// Preview resolver: requires versionId
const runtimeResolverRoutes = Router({ mergeParams: true });

runtimeResolverRoutes.post(
    "/",
    authenticate,
    requireOrganizationMember,
    testResolveEndpoint
);

// Active resolver: automatically selects the active version
export const activeRuntimeResolverRoutes = Router({
    mergeParams: true,
});

export const mockExecutionRoutes = Router({
    mergeParams: true,
});
export const dataExecutionRoutes = Router({
    mergeParams: true,
});

activeRuntimeResolverRoutes.post(
    "/active",
    authenticate,
    requireOrganizationMember,
    resolveActiveRuntime
);

mockExecutionRoutes.post(
    "/",
    authenticate,
    requireOrganizationMember,
    executeMockRuntime
);
dataExecutionRoutes.post(
    "/",
    authenticate,
    requireOrganizationMember,
    requireDataRuntimeAccess,
    executeDataRuntime
);

export default runtimeResolverRoutes;