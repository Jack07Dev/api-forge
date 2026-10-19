import { Router } from "express";

import { authenticate } from "../middlewares/auth.middleware.js";

import {
    requireOrganizationMember,
    requireRole,
} from "../middlewares/organization.middleware.js";

import {
  createMock,
  getMock,
  updateMock,
  deleteMock,
} from "../controllers/api-endpoint-mock.controller.js"

const router = Router();

const mockPath =
    "/:organizationId/projects/:projectId" +
    "/apis/:apiId/versions/:versionId" +
    "/endpoints/:endpointId/mock";

// Create mock response
router.post(
    mockPath,
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    createMock
);

// Get mock response
router.get(
    mockPath,
    authenticate,
    requireOrganizationMember,
    getMock
);

// Update mock response
router.patch(
    mockPath,
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    updateMock
);

// Delete mock response
router.delete(
    mockPath,
    authenticate,
    requireOrganizationMember,
    requireRole("owner", "admin"),
    deleteMock
);

export default router;