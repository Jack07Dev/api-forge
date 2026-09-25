import { Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { createProject, getOrganizationProjects, getProjectById, updateProject, archiveProject } from "../services/project.service.js";

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

        if (!req.organization) {
            res.status(403).json({
                success: false,
                message: "Organization access required"
            });
            return;
        }

        const { name, description } = req.body;

        if (!name) {
            res.status(400).json({
                success: false,
                message: "Project name is required"
            });
            return;
        }

        const project = await createProject({
            name,
            description,
            organizationId: req.organization.id,
            userId: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: {
                id: project._id,
                name: project.name,
                slug: project.slug,
                description: project.description,
                organizationId: project.organizationId,
                createdBy: project.createdBy,
                status: project.status,
                createdAt: project.createdAt
            }
        });
    } catch (error) {
        console.error("Create project error:", error);

        res.status(400).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to create project"
        });
    }
};

export const list = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.organization) {
            res.status(403).json({
                success: false,
                message: "Organization access required"
            });
            return;
        }

        const projects = await getOrganizationProjects(
            req.organization.id
        );

        res.status(200).json({
            success: true,
            data: projects
        });
    } catch (error) {
        console.error("Get projects error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get projects"
        });
    }
};

export const getById = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.organization) {
            res.status(403).json({
                success: false,
                message: "Organization access required"
            });
            return;
        }

        const { projectId } = req.params;

        if (
            !projectId ||
            typeof projectId !== "string" ||
            !mongoose.Types.ObjectId.isValid(projectId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
            return;
        }

        const project = await getProjectById(
            projectId,
            req.organization.id
        );

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: project
        });
    } catch (error) {
        console.error("Get project error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to get project"
        });
    }
};

export const update = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        if (!req.organization) {
            res.status(403).json({
                success: false,
                message: "Organization access required"
            });
            return;
        }

        const { projectId } = req.params;

        if (
            !projectId ||
            typeof projectId !== "string" ||
            !mongoose.Types.ObjectId.isValid(projectId)
        ) {
            res.status(400).json({
                success: false,
                message: "Invalid project ID"
            });
            return;
        }

        const { name, description } = req.body;

        if (
            name === undefined &&
            description === undefined
        ) {
            res.status(400).json({
                success: false,
                message: "No fields provided for update"
            });
            return;
        }

        if (
            name !== undefined &&
            typeof name !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Project name must be a string"
            });
            return;
        }

        if (
            description !== undefined &&
            typeof description !== "string"
        ) {
            res.status(400).json({
                success: false,
                message: "Project description must be a string"
            });
            return;
        }

        const project = await updateProject({
            projectId,
            organizationId: req.organization.id,
            name,
            description
        });

        if (!project) {
            res.status(404).json({
                success: false,
                message: "Project not found"
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Project updated successfully",
            data: project
        });
    } catch (error) {
        console.error("Update project error:", error);

        res.status(400).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to update project"
        });
    }
};

export const archive = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.organization) {
      res.status(403).json({
        success: false,
        message: "Organization access required"
      });
      return;
    }

    const { projectId } = req.params;

    if (
      !projectId ||
      typeof projectId !== "string" ||
      !mongoose.Types.ObjectId.isValid(projectId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
      return;
    }

    const project = await archiveProject(
      projectId,
      req.organization.id
    );

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Active project not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Project archived successfully",
      data: project
    });
  } catch (error) {
    console.error("Archive project error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to archive project"
    });
  }
};