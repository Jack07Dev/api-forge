import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import projectRoutes from "./routes/project.routes.js";
import apiRoutes from "./routes/api.routes.js";
import apiVersionRoutes from "./routes/api-version.routes.js";
import apiModelRoutes from "./routes/api-model.routes.js";
import apiEndpointRoutes from "./routes/api-endpoint.routes.js";
import apiEndpointParameterRoutes from "./routes/api-endpoint-parameter.routes.js";
import apiEndpointRequestBodyRoutes from "./routes/api-endpoint-request-body.routes.js";
import apiEndpointResponseRoutes from "./routes/api-endpoint-response.routes.js";
import apiEndpointSecurityRoutes from "./routes/api-endpoint-security.routes.js";
import apiDefinitionValidationRoutes from "./routes/api-definition-validation.routes.js";
import openapiGeneratorRoutes from "./routes/openapi-generator.routes.js";
import openapiValidationRoutes from "./routes/openapi-validation.routes.js";
import openapiExportRoutes from "./routes/openapi-export.routes.js";


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
app.use("/api/organizations", apiModelRoutes);
app.use("/api/organizations", apiEndpointRoutes);
app.use("/api/organizations", apiEndpointParameterRoutes);
app.use("/api/organizations", apiEndpointRequestBodyRoutes);
app.use("/api/organizations", apiEndpointResponseRoutes);
app.use("/api/organizations", apiEndpointSecurityRoutes);
app.use("/api/organizations", apiDefinitionValidationRoutes);
app.use(
    "/api/organizations/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/openapi",
    openapiGeneratorRoutes
);
app.use(
    "/api/organizations/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/openapi/validate",
    openapiValidationRoutes
);
app.use(
  "/api/organizations/:organizationId/projects/:projectId/apis/:apiId/versions/:versionId/openapi/export",
  openapiExportRoutes
);


app.get("/api/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "API Platform API is running",
        timestamp: new Date().toISOString()
    });
});

export default app;