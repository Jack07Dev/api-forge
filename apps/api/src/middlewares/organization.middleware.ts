import { Response, NextFunction } from "express";
import mongoose from "mongoose";

import Organization from "../models/Organization.js";
import OrganizationMember, {
  OrganizationRole
} from "../models/OrganizationMember.js";

import { AuthenticatedRequest } from "./auth.middleware.js";

export const requireOrganizationMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const { organizationId } = req.params;

    if (
      !organizationId ||
      typeof organizationId !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Organization ID is required"
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      res.status(400).json({
        success: false,
        message: "Invalid organization ID"
      });
      return;
    }

    const organization = await Organization.findOne({
      _id: organizationId,
      isActive: true
    });

    if (!organization) {
      res.status(404).json({
        success: false,
        message: "Organization not found"
      });
      return;
    }

    const membership = await OrganizationMember.findOne({
      organizationId,
      userId: req.user.userId
    });

    if (!membership) {
      res.status(403).json({
        success: false,
        message:
          "You are not a member of this organization"
      });
      return;
    }

    req.organization = {
      id: organization._id.toString(),
      role: membership.role
    };

    next();
  } catch (error) {
    console.error(
      "Organization access middleware error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to verify organization access"
    });
  }
};

export const requireRole = (
  ...allowedRoles: OrganizationRole[]
) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.organization) {
      res.status(403).json({
        success: false,
        message: "Organization access required"
      });
      return;
    }

    if (
      !allowedRoles.includes(
        req.organization.role
      )
    ) {
      res.status(403).json({
        success: false,
        message:
          "You don't have permission for this action"
      });
      return;
    }

    next();
  };
};