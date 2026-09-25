import { Response } from "express";
import {
  createOrganization,
  getUserOrganizations
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