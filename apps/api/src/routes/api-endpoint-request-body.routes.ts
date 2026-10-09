
import { Router } from "express";
import { create, getByEndpoint, update, remove } from "../controllers/api-endpoint-request-body.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
    requireOrganizationMember,
    requireRole
} from "../middlewares/organization.middleware.js";

const router = Router();

router.post(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId/request-body",
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    create
);

router.get(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId/request-body",
    authenticate,
    requireOrganizationMember,
    getByEndpoint
);

router.patch(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId/request-body",
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    update
);

router.delete(
    "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId/request-body",
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    remove
);

export default router;
