import { Router } from "express";

import {
    authenticate
} from "../middlewares/auth.middleware.js";

import {
    requireOrganizationMember,
    requireRole
} from "../middlewares/organization.middleware.js";

import {
    create,
    list,
    getById,
    update,
    archive
} from "../controllers/api-model.controller.js";

const router = Router();

router.post(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/models",
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    create
);

router.get(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/models",
    authenticate,
    requireOrganizationMember,
    list
);

router.get(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/models/:modelId",
    authenticate,
    requireOrganizationMember,
    getById
);

router.patch(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/models/:modelId",
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    update
);

router.patch(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/models/:modelId/archive",
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    archive
);

export default router;