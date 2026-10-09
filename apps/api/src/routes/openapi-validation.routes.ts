import { Router } from "express";

import { validateOpenAPI } from "../controllers/openapi-validation.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { requireOrganizationMember } from "../middlewares/organization.middleware.js";

const router = Router({ mergeParams: true });

router.post(
  "/",
  authenticate,
  requireOrganizationMember,
  validateOpenAPI
);

export default router;