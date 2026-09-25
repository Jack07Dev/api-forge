import { Router } from "express";

import { create, list, getById } from "../controllers/api-version.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

import {
  requireOrganizationMember,
  requireRole
} from "../middlewares/organization.middleware.js";

const router = Router();

router.post(
  "/:organizationId/projects/:projectId/apis/:apiId/versions",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  create
);

router.get(
  "/:organizationId/projects/:projectId/apis/:apiId/versions",
  authenticate,
  requireOrganizationMember,
  list
);

router.get(
  "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId",
  authenticate,
  requireOrganizationMember,
  getById
);

export default router;