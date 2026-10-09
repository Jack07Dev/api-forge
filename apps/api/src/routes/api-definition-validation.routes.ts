import { Router } from "express";

import {
  validate,
} from "../controllers/api-definition-validation.controller.js";

import {
  authenticate,
} from "../middlewares/auth.middleware.js";

import {
  requireOrganizationMember,
} from "../middlewares/organization.middleware.js";

const router = Router();

router.post(
  "/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/validate",
  authenticate,
  requireOrganizationMember,
  validate,
);

export default router;