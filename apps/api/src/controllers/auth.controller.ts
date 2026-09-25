import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { registerUser, loginUser } from "../services/auth.service.js";
import User from "../models/User.js"

export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
      return;
    }

    const user = await registerUser({
      name,
      email,
      password
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user
    });
  } catch (error) {
    console.error("Register error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Registration failed";

    res.status(400).json({
      success: false,
      message
    });
  }
};

export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
      return;
    }

    const { token, user } = await loginUser({
      email,
      password
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: user
    });
  } catch (error) {
    console.error("Login error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Login failed";

    res.status(401).json({
      success: false,
      message
    });
  }
};

export const getMe = async (
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

    const user = await User.findById(req.user.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "User account is inactive"
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error("Get current user error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get current user"
    });
  }
};

export const logout = (
  _req: Request,
  res: Response
): void => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax"
  });

  res.status(200).json({
    success: true,
    message: "Logout successful"
  });
};