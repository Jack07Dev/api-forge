import { Router, Response } from "express";

import {
  authenticate,
  AuthenticatedRequest
} from "../middlewares/auth.middleware.js";
import {
  requireOrganizationMember,
  requireRole
} from "../middlewares/organization.middleware.js";

const router = Router();

router.get(
  "/:organizationId/test",
  authenticate,
  requireOrganizationMember,
  (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Organization access verified",
      data: {
        organizationId: req.organization?.id,
        role: req.organization?.role,
        userId: req.user?.userId
      }
    });
  }
);

router.get(
  "/:organizationId/admin-test",
  authenticate,
  requireOrganizationMember,
  requireRole("owner", "admin"),
  (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Admin-level organization access verified",
      data: {
        organizationId: req.organization?.id,
        role: req.organization?.role
      }
    });
  }
);

export default router;