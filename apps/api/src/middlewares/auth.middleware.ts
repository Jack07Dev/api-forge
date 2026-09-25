import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import OrganizationMember, {
    OrganizationRole
} from "../models/OrganizationMember.js";

export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        role: "user" | "admin";
    };
    
    organization?: {
    id: string;
    role: OrganizationRole;
  };
}

interface JwtPayload {
    userId: string;
    role: "user" | "admin";
}

export const authenticate = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const token = req.cookies?.token;

        if (!token) {
            res.status(401).json({
                success: false,
                message: "Authentication required"
            });
            return;
        }

        const decoded = jwt.verify(
            token,
            env.jwtSecret
        ) as JwtPayload;

        req.user = {
            userId: decoded.userId,
            role: decoded.role
        };

        next();
    } catch (error) {
        console.error("Authentication error:", error);

        res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token"
        });
    }
};