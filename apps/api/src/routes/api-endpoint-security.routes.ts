import { Router } from "express";

import {
    create,
    list,
    update,
    remove
} from "../controllers/api-endpoint-security.controller.js";

import {
    authenticate,
} from "../middlewares/auth.middleware.js";

import {
    requireOrganizationMember,
    requireRole,
} from "../middlewares/organization.middleware.js";

const router = Router();

router.post(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId/security",
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    create,
);

router.get(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId/security",
    authenticate,
    requireOrganizationMember,
    list,
);

router.patch(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId/security",
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    update,
);

router.delete(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId/security",
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    remove,
);

export default router;