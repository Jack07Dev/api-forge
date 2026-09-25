import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import organizationTestRoutes from "./routes/organization-test.routes.js";
import projectRoutes from "./routes/project.routes.js";
import apiRoutes from "./routes/api.routes.js";
import apiVersionRoutes from "./routes/api-version.routes.js";

const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true
    })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/organizations", projectRoutes);
app.use("/api/organizations", apiRoutes);
app.use("/api/organizations", apiVersionRoutes);

app.use(
  "/api/organization-test",
  organizationTestRoutes
);

app.get("/api/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "API Platform API is running",
        timestamp: new Date().toISOString()
    });
});

export default app;