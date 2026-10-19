import mongoose from "mongoose";

import type {
    IAPIModelField,
} from "../../models/APIModel.js";

export interface BodyValidationError {
    field: string;
    message: string;
}

interface ValidateRequestBodyInput {
    body: unknown;
    required: boolean;
    fields: Pick<IAPIModelField, "name" | "type" | "required">[];
}

export const validateRequestBody = ({
    body,
    required,
    fields,
}: ValidateRequestBodyInput): BodyValidationError[] => {
    const errors: BodyValidationError[] = [];

    if (body === undefined || body === null) {
        if (required) {
            errors.push({
                field: "body",
                message: "Request body is required",
            });
        }

        return errors;
    }

    if (
        typeof body !== "object" ||
        Array.isArray(body)
    ) {
        return [{
            field: "body",
            message: "Request body must be a JSON object",
        }];
    }

    const data = body as Record<string, unknown>;

    for (const field of fields) {
        const value = Object.prototype.hasOwnProperty.call(
            data,
            field.name
        )
            ? data[field.name]
            : undefined;

        if (value === undefined || value === null) {
            if (field.required) {
                errors.push({
                    field: field.name,
                    message: `${field.name} is required`,
                });
            }
            continue;
        }

        let valid = false;

        switch (field.type) {
            case "string":
                valid = typeof value === "string";
                break;

            case "number":
                valid =
                    typeof value === "number" &&
                    Number.isFinite(value);
                break;

            case "boolean":
                valid = typeof value === "boolean";
                break;

            case "date":
                valid =
                    typeof value === "string" &&
                    !Number.isNaN(Date.parse(value));
                break;

            case "objectId":
                valid =
                    typeof value === "string" &&
                    /^[0-9a-fA-F]{24}$/.test(value) &&
                    mongoose.isValidObjectId(value);
                break;
        }

        if (!valid) {
            errors.push({
                field: field.name,
                message: `${field.name} must be a valid ${field.type}`,
            });
        }
    }

    return errors;
};