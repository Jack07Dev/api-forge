import { Router } from "express";

import { exportOpenAPI } from "../controllers/openapi-export.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { requireOrganizationMember } from "../middlewares/organization.middleware.js";

const router = Router({ mergeParams: true });

router.get(
    "/",
    authenticate,
    requireOrganizationMember,
    exportOpenAPI
);

export default router;