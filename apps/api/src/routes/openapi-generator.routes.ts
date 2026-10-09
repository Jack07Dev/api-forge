import { Router } from "express";
import { getOpenAPISpec } from "../controllers/openapi-generator.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";
import { requireOrganizationMember } from "../middlewares/organization.middleware.js";

const router = Router({ mergeParams: true });

router.get(
    "/",
    authenticate,
    requireOrganizationMember,
    getOpenAPISpec
);

export default router;