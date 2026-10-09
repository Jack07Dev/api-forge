import SwaggerParser from "@apidevtools/swagger-parser";

export interface OpenAPIValidationResult {
    valid: boolean;
    message: string;
    errors: string[];
}

export const validateOpenAPISpec = async (
    specification: Record<string, any>
): Promise<OpenAPIValidationResult> => {
    try {
        await SwaggerParser.validate(
            structuredClone(specification) as any
        );

        return {
            valid: true,
            message: "OpenAPI specification is valid",
            errors: []
        };
    } catch (error) {
        return {
            valid: false,
            message: "OpenAPI specification validation failed",
            errors: [
                error instanceof Error
                    ? error.message
                    : "Unknown OpenAPI validation error"
            ]
        };
    }
};