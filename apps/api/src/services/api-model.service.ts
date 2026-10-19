import APIModel, {
    APIFieldType
} from "../models/APIModel.js";
import {
    withDraftVersionTransaction,
} from "./api-version-guard.service.js";
import API from "../models/API.js";
import APIVersion from "../models/APIVersion.js";
import Project from "../models/Project.js";

interface CreateAPIModelInput {
    name: string;
    description?: string;

    apiId: string;
    versionId: string;
    projectId: string;
    organizationId: string;

    userId: string;

    fields?: {
        name: string;
        type: APIFieldType;
        required?: boolean;
        unique?: boolean;
        description?: string;
    }[];
}

interface UpdateAPIModelInput {
    modelId: string;
    apiId: string;
    versionId: string;
    projectId: string;
    organizationId: string;

    name?: string;
    description?: string;

    fields?: {
        name: string;
        type: APIFieldType;
        required?: boolean;
        unique?: boolean;
        description?: string;
    }[];
}

interface APIModelFieldInput {
    name: string;
    type: APIFieldType;
    required?: boolean;
    unique?: boolean;
    description?: string;
}

const MAX_MODEL_FIELDS = 50;

const RESERVED_FIELD_NAMES = new Set([
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "deletedAt"
]);

const ALLOWED_FIELD_TYPES: APIFieldType[] = [
    "string",
    "number",
    "boolean",
    "date",
    "objectId"
];

/*
 * Validate and normalize model fields
 */
const normalizeAndValidateFields = (
    fields: unknown
) => {
    if (!Array.isArray(fields)) {
        throw new Error(
            "Fields must be an array"
        );
    }

    if (fields.length > MAX_MODEL_FIELDS) {
        throw new Error(
            `A model cannot contain more than ${MAX_MODEL_FIELDS} fields`
        );
    }

    const normalizedFields =
        fields.map((field, index) => {
            if (
                typeof field !== "object" ||
                field === null ||
                Array.isArray(field)
            ) {
                throw new Error(
                    `Invalid field definition at index ${index}`
                );
            }

            const input =
                field as Partial<APIModelFieldInput>;

            /*
             * Field name
             */
            if (
                typeof input.name !== "string"
            ) {
                throw new Error(
                    `Field name is required at index ${index}`
                );
            }

            const fieldName =
                input.name.trim();

            if (!fieldName) {
                throw new Error(
                    `Field name cannot be empty at index ${index}`
                );
            }

            if (fieldName.length > 100) {
                throw new Error(
                    `Field name "${fieldName}" cannot exceed 100 characters`
                );
            }

            /*
             * Field name format
             *
             * Must:
             * - start with a letter
             * - contain only letters, numbers, _
             */
            if (
                !/^[A-Za-z][A-Za-z0-9_]*$/.test(
                    fieldName
                )
            ) {
                throw new Error(
                    `Invalid field name "${fieldName}". Use letters, numbers and underscores only, and start with a letter`
                );
            }

            /*
             * Reserved field names
             *
             * Case-insensitive
             */
            if (
                RESERVED_FIELD_NAMES.has(
                    fieldName.toLowerCase()
                )
            ) {
                throw new Error(
                    `Field name "${fieldName}" is reserved`
                );
            }

            /*
             * Field type
             */
            if (
                typeof input.type !== "string" ||
                !ALLOWED_FIELD_TYPES.includes(
                    input.type as APIFieldType
                )
            ) {
                throw new Error(
                    `Invalid field type for "${fieldName}"`
                );
            }

            /*
             * Required
             */
            if (
                input.required !== undefined &&
                typeof input.required !== "boolean"
            ) {
                throw new Error(
                    `Field "required" must be a boolean for "${fieldName}"`
                );
            }

            /*
             * Unique
             */
            if (
                input.unique !== undefined &&
                typeof input.unique !== "boolean"
            ) {
                throw new Error(
                    `Field "unique" must be a boolean for "${fieldName}"`
                );
            }

            /*
             * Field description
             */
            let description:
                | string
                | undefined;

            if (
                input.description !== undefined
            ) {
                if (
                    typeof input.description !==
                    "string"
                ) {
                    throw new Error(
                        `Field description must be a string for "${fieldName}"`
                    );
                }

                description =
                    input.description.trim();

                if (
                    description.length > 500
                ) {
                    throw new Error(
                        `Field description cannot exceed 500 characters for "${fieldName}"`
                    );
                }
            }

            return {
                name: fieldName,
                type: input.type as APIFieldType,
                required:
                    input.required ?? false,
                unique:
                    input.unique ?? false,
                description
            };
        });

    /*
     * Case-insensitive duplicate detection
     *
     * email
     * Email
     * EMAIL
     *
     * are considered duplicates.
     */
    const normalizedNames =
        normalizedFields.map(
            (field) =>
                field.name.toLowerCase()
        );

    const uniqueNames =
        new Set(normalizedNames);

    if (
        uniqueNames.size !==
        normalizedNames.length
    ) {
        throw new Error(
            "Model cannot contain duplicate field names"
        );
    }

    return normalizedFields;
};

/*
 * Create slug
 */
const createSlug = (
    name: string
): string => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
};

/*
 * Create API Model
 */
export const createAPIModel = async ({
    name,
    description,
    apiId,
    versionId,
    projectId,
    organizationId,
    userId,
    fields = [],
}: CreateAPIModelInput) => {
    if (typeof name !== "string") {
        throw new Error("Model name is required");
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
        throw new Error("Model name is required");
    }

    if (trimmedName.length < 2) {
        throw new Error("Model name must be at least 2 characters");
    }

    if (trimmedName.length > 100) {
        throw new Error("Model name cannot exceed 100 characters");
    }

    if (description !== undefined) {
        if (typeof description !== "string") {
            throw new Error("Model description must be a string");
        }

        if (description.trim().length > 500) {
            throw new Error("Model description cannot exceed 500 characters");
        }
    }

    const slug = createSlug(trimmedName);

    if (!slug) {
        throw new Error("Invalid model name");
    }

    const normalizedFields = normalizeAndValidateFields(fields);

    return withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId,
        },
        async (session) => {
            const project = await Project.findOne({
                _id: projectId,
                organizationId,
                status: "active",
            }).session(session);

            if (!project) {
                throw new Error("Project not found or is not active");
            }

            const api = await API.findOne({
                _id: apiId,
                projectId,
                organizationId,
            }).session(session);

            if (!api) {
                throw new Error("API not found");
            }

            const apiVersion = await APIVersion.findOne({
                _id: versionId,
                apiId,
                projectId,
                organizationId,
            }).session(session);

            if (!apiVersion) {
                throw new Error("API version not found");
            }

            if (apiVersion.status === "archived") {
                throw new Error(
                    "Cannot create a model for an archived API version"
                );
            }

            const existingModel = await APIModel.findOne({
                versionId,
                slug,
            }).session(session);

            if (existingModel) {
                throw new Error(
                    "A model with this name already exists in this API version"
                );
            }

            const [model] = await APIModel.create(
                [
                    {
                        name: trimmedName,
                        slug,
                        description: description?.trim(),
                        apiId,
                        versionId,
                        projectId,
                        organizationId,
                        fields: normalizedFields,
                        status: "draft",
                        createdBy: userId,
                    },
                ],
                { session }
            );

            return model;
        }
    );
};

/*
 * Get all API Models
 */
export const getAPIModels = async (
    apiId: string,
    versionId: string,
    projectId: string,
    organizationId: string
) => {
    return APIModel.find({
        apiId,
        versionId,
        projectId,
        organizationId
    })
        .sort({
            createdAt: -1
        })
        .select(
            "_id name slug description apiId versionId projectId organizationId fields status createdBy createdAt updatedAt"
        );
};

/*
 * Get API Model by ID
 */
export const getAPIModelById = async (
    modelId: string,
    apiId: string,
    versionId: string,
    projectId: string,
    organizationId: string
) => {
    return APIModel.findOne({
        _id: modelId,
        apiId,
        versionId,
        projectId,
        organizationId
    });
};

/*
 * Update API Model
 */
export const updateAPIModel = async ({
    modelId,
    apiId,
    versionId,
    projectId,
    organizationId,
    name,
    description,
    fields,
}: UpdateAPIModelInput) => {
    const updateData: {
        name?: string;
        slug?: string;
        description?: string;
        fields?: ReturnType<typeof normalizeAndValidateFields>;
    } = {};

    if (name !== undefined) {
        if (typeof name !== "string") {
            throw new Error("Model name cannot be empty");
        }

        const trimmedName = name.trim();

        if (!trimmedName) {
            throw new Error("Model name cannot be empty");
        }

        if (trimmedName.length < 2) {
            throw new Error("Model name must be at least 2 characters");
        }

        if (trimmedName.length > 100) {
            throw new Error("Model name cannot exceed 100 characters");
        }

        const slug = createSlug(trimmedName);

        if (!slug) {
            throw new Error("Invalid model name");
        }

        updateData.name = trimmedName;
        updateData.slug = slug;
    }

    if (description !== undefined) {
        if (typeof description !== "string") {
            throw new Error("Model description must be a string");
        }

        const trimmedDescription = description.trim();

        if (trimmedDescription.length > 500) {
            throw new Error("Model description cannot exceed 500 characters");
        }

        updateData.description = trimmedDescription;
    }

    if (fields !== undefined) {
        updateData.fields = normalizeAndValidateFields(fields);
    }

    if (Object.keys(updateData).length === 0) {
        throw new Error("At least one field is required");
    }

    return withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId,
        },
        async (session) => {
            const model = await APIModel.findOne({
                _id: modelId,
                apiId,
                versionId,
                projectId,
                organizationId,
            }).session(session);

            if (!model) {
                throw new Error("API model not found");
            }

            if (model.status === "archived") {
                throw new Error("Cannot update an archived API model");
            }

            if (updateData.slug !== undefined) {
                const existingModel = await APIModel.findOne({
                    versionId,
                    slug: updateData.slug,
                    _id: { $ne: modelId },
                }).session(session);

                if (existingModel) {
                    throw new Error(
                        "A model with this name already exists in this API version"
                    );
                }
            }

            const updatedModel = await APIModel.findOneAndUpdate(
                {
                    _id: modelId,
                    apiId,
                    versionId,
                    projectId,
                    organizationId,
                    status: { $ne: "archived" },
                },
                { $set: updateData },
                {
                    new: true,
                    runValidators: true,
                    session,
                }
            );

            if (!updatedModel) {
                throw new Error("API model not found");
            }

            return updatedModel;
        }
    );
};

/*
 * Archive API Model
 */
export const archiveAPIModel = async (
    modelId: string,
    apiId: string,
    versionId: string,
    projectId: string,
    organizationId: string
) => {
    return withDraftVersionTransaction(
        {
            organizationId,
            projectId,
            apiId,
            apiVersionId: versionId,
        },
        async (session) => {
            const model = await APIModel.findOne({
                _id: modelId,
                apiId,
                versionId,
                projectId,
                organizationId,
            }).session(session);

            if (!model) {
                throw new Error("API model not found");
            }

            if (model.status === "archived") {
                throw new Error("API model is already archived");
            }

            model.status = "archived";

            await model.save({ session });

            return model;
        }
    );
};