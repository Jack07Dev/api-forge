import { Router } from "express";

import {
  create,
  list,
  getById,
  update,
  archive
} from "../controllers/api-endpoint.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

import {
  requireOrganizationMember,
  requireRole
} from "../middlewares/organization.middleware.js";

const router = Router();

router.post(
  "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  create
);

router.get(
  "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints",
  authenticate,
  requireOrganizationMember,
  list
);

router.get(
  "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId",
  authenticate,
  requireOrganizationMember,
  getById
);

router.patch(
  "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  update
);

router.patch(
  "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/endpoints/:endpointId/archive",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  archive
);


export default router;