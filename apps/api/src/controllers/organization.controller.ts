import { Response } from "express";
import mongoose from "mongoose";
import {
  createOrganization,
  getUserOrganizations,
  getOrganizationById,
  archiveOrganization
} from "../services/organization.service.js";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

export const create = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const { name } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: "Organization name is required"
      });
      return;
    }

    const organization = await createOrganization({
      name,
      userId: req.user.userId
    });

    res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        ownerId: organization.ownerId
      }
    });
  } catch (error) {
    console.error(
      "Create organization error:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create organization"
    });
  }
};

export const list = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const organizations =
      await getUserOrganizations(
        req.user.userId
      );

    res.status(200).json({
      success: true,
      data: organizations
    });
  } catch (error) {
    console.error(
      "Get organizations error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to get organizations"
    });
  }
};

export const getById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const { organizationId } =
      req.params;

    if (
      typeof organizationId !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Organization ID is required"
      });
      return;
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        organizationId
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid organization ID"
      });
      return;
    }

    const organization =
      await getOrganizationById(
        organizationId,
        req.user.userId
      );

    if (!organization) {
      res.status(404).json({
        success: false,
        message: "Organization not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        ownerId: organization.ownerId,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
      }
    });
  } catch (error) {
    console.error(
      "Get organization error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to get organization"
    });
  }
};

export const archive = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const { organizationId } =
      req.params;

    if (
      typeof organizationId !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Organization ID is required"
      });
      return;
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        organizationId
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid organization ID"
      });
      return;
    }

    const organization =
      await archiveOrganization(
        organizationId,
        req.user.userId
      );

    res.status(200).json({
      success: true,
      message:
        "Organization archived successfully",
      data: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        ownerId: organization.ownerId,
        isActive: organization.isActive,
        updatedAt: organization.updatedAt
      }
    });
  } catch (error) {
    console.error(
      "Archive organization error:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to archive organization"
    });
  }
};