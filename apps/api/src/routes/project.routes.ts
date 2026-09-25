import { Router } from "express";

import { create, list, getById, update, archive } from "../controllers/project.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

import {
  requireOrganizationMember,
  requireRole
} from "../middlewares/organization.middleware.js";

const router = Router();

router.post(
  "/:organizationId/projects",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  create
);
router.get(
  "/:organizationId/projects",
  authenticate,
  requireOrganizationMember,
  list
);

router.get(
  "/:organizationId/projects/:projectId",
  authenticate,
  requireOrganizationMember,
  getById
);

router.patch(
  "/:organizationId/projects/:projectId",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  update
);

router.patch(
  "/:organizationId/projects/:projectId/archive",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  archive
);


export default router;