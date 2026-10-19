import mongoose from "mongoose";

import type {
    EndpointParameterDataType,
    EndpointParameterLocation,
} from "../../models/APIEndpointParameter.js";

export interface ParameterRule {
    name: string;
    location: EndpointParameterLocation;
    dataType: EndpointParameterDataType;
    required: boolean;
    defaultValue?: unknown;
}

export interface ParameterValidationError {
    location: EndpointParameterLocation;
    field: string;
    message: string;
}

interface ValidateParametersInput {
    rules: ParameterRule[];
    params: Record<string, string>;
    query: Record<string, string>;
    headers: Record<string, string | string[] | undefined>;
}

export const validateRequestParameters = ({
    rules,
    params,
    query,
    headers,
}: ValidateParametersInput): ParameterValidationError[] => {
    const errors: ParameterValidationError[] = [];

    for (const rule of rules) {
        const source =
            rule.location === "path"
                ? params
                : rule.location === "query"
                    ? query
                    : headers;

        const key =
            rule.location === "header"
                ? rule.name.toLowerCase()
                : rule.name;

        let value = source[key];

        if (
            (value === undefined || value === "") &&
            !rule.required &&
            rule.location !== "path" &&
            rule.defaultValue !== undefined
        ) {
            const defaultValue = rule.defaultValue;

            if (typeof defaultValue !== "string" || defaultValue === "") {
                errors.push({
                    location: rule.location,
                    field: rule.name,
                    message: `${rule.name} has an invalid default value`,
                });
                continue;
            }

            value = defaultValue;
            source[key] = defaultValue;
        }

        if (value === undefined || value === "") {
            if (rule.required) {
                errors.push({
                    location: rule.location,
                    field: rule.name,
                    message: `${rule.name} is required`,
                });
            }
            continue;
        }

        if (typeof value !== "string") {
            errors.push({
                location: rule.location,
                field: rule.name,
                message: `${rule.name} must be a single value`,
            });
            continue;
        }

        let valid = false;

        switch (rule.dataType) {
            case "string":
                valid = true;
                break;

            case "number":
                valid =
                    value.trim() !== "" &&
                    Number.isFinite(Number(value));
                break;

            case "boolean":
                valid = value === "true" || value === "false";
                break;

            case "date":
                valid = !Number.isNaN(Date.parse(value));
                break;

            case "objectId":
                valid = /^[0-9a-fA-F]{24}$/.test(value) &&
                    mongoose.isValidObjectId(value);
                break;
        }

        if (!valid) {
            errors.push({
                location: rule.location,
                field: rule.name,
                message: `${rule.name} must be a valid ${rule.dataType}`,
            });
        }
    }

    return errors;
};