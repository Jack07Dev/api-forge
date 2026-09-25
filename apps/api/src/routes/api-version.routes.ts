import { Router } from "express";

import { create, list, getById, updateStatus, update } from "../controllers/api-version.controller.js";

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

router.patch(
  "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/status",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  updateStatus
);

router.patch(
  "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  update
);

export default router;