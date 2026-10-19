
import mongoose from "mongoose";

import APIDataRecord from "../../models/APIDataRecord.js";

import type {
    IAPIModelField,
} from "../../models/APIModel.js";

import {
    validateRequestBody,
} from "../validators/request-body.validator.js";

export interface DataRecordScope {
    organizationId: string;
    projectId: string;
    apiId: string;
    apiVersionId: string;
    modelId: string;
}

interface CreateDataRecordInput {
    scope: DataRecordScope;
    fields: IAPIModelField[];
    body: unknown;
}

interface FindManyDataRecordsInput {
    scope: DataRecordScope;
    limit?: number;
    skip?: number;
}

interface FindOneDataRecordInput {
    scope: DataRecordScope;
    recordId: string;
}

interface UpdateDataRecordInput {
    scope: DataRecordScope;
    recordId: string;
    fields: IAPIModelField[];
    body: unknown;
}

interface DeleteDataRecordInput {
    scope: DataRecordScope;
    recordId: string;
}


const BLOCKED_KEYS = new Set([
    "__proto__",
    "prototype",
    "constructor",
]);

const isSafeFieldName = (name: string): boolean =>
    name.length > 0 &&
    !name.startsWith("$") &&
    !name.includes(".") &&
    !BLOCKED_KEYS.has(name);

export const createDataRecord = async ({
    scope,
    fields,
    body,
}: CreateDataRecordInput) => {
    const scopeIds = Object.values(scope);

    if (
        scopeIds.some(
            (id) => !mongoose.isObjectIdOrHexString(id)
        )
    ) {
        throw new Error("RUNTIME_INVALID_RECORD_SCOPE");
    }

    if (
        body === null ||
        typeof body !== "object" ||
        Array.isArray(body)
    ) {
        throw new Error("RUNTIME_INVALID_RECORD_BODY");
    }

    const payload = body as Record<string, unknown>;

    const allowedFields = new Set<string>();

    for (const field of fields) {
        if (!isSafeFieldName(field.name)) {
            throw new Error("RUNTIME_UNSAFE_MODEL_FIELD");
        }

        if (allowedFields.has(field.name)) {
            throw new Error("RUNTIME_DUPLICATE_MODEL_FIELD");
        }

        allowedFields.add(field.name);
    }

    for (const key of Object.keys(payload)) {
        if (
            !isSafeFieldName(key) ||
            !allowedFields.has(key)
        ) {
            throw new Error("RUNTIME_UNKNOWN_RECORD_FIELD");
        }
    }

    const validationErrors = validateRequestBody({
        body: payload,
        required: true,
        fields,
    });

    if (validationErrors.length > 0) {
        const error = new Error(
            "RUNTIME_RECORD_VALIDATION_FAILED"
        );

        Object.assign(error, {
            validationErrors,
        });

        throw error;
    }

    // Build a fresh object containing only approved fields.
    const data: Record<string, unknown> =
        Object.create(null);

    for (const field of fields) {
        if (
            Object.prototype.hasOwnProperty.call(
                payload,
                field.name
            )
        ) {
            data[field.name] = payload[field.name];
        }
    }

    const record = await APIDataRecord.create({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        apiId: scope.apiId,
        apiVersionId: scope.apiVersionId,
        modelId: scope.modelId,
        data,
    });

    return record.toObject();
};




const validateRecordScope = (
    scope: DataRecordScope
): void => {
    const ids = [
        scope.organizationId,
        scope.projectId,
        scope.apiId,
        scope.apiVersionId,
        scope.modelId,
    ];

    if (
        ids.some(
            (id) => !mongoose.isObjectIdOrHexString(id)
        )
    ) {
        throw new Error("RUNTIME_INVALID_RECORD_SCOPE");
    }
};

export const findManyDataRecords = async ({
    scope,
    limit = 20,
    skip = 0,
}: FindManyDataRecordsInput) => {
    validateRecordScope(scope);

    if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw new Error("RUNTIME_INVALID_RECORD_LIMIT");
    }

    if (
        !Number.isSafeInteger(skip) ||
        skip < 0 ||
        skip > 10000
    ) {
        throw new Error("RUNTIME_INVALID_RECORD_SKIP");
    }

    return APIDataRecord.find({
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        apiId: scope.apiId,
        apiVersionId: scope.apiVersionId,
        modelId: scope.modelId,
    })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
};

export const findOneDataRecord = async ({
    scope,
    recordId,
}: FindOneDataRecordInput) => {
    validateRecordScope(scope);

    if (!mongoose.isObjectIdOrHexString(recordId)) {
        throw new Error("RUNTIME_INVALID_RECORD_ID");
    }

    return APIDataRecord.findOne({
        _id: recordId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        apiId: scope.apiId,
        apiVersionId: scope.apiVersionId,
        modelId: scope.modelId,
    }).lean();
};

const validateRecordId = (recordId: string): void => {
    if (!mongoose.isObjectIdOrHexString(recordId)) {
        throw new Error("RUNTIME_INVALID_RECORD_ID");
    }
};

export const updateDataRecord = async ({
    scope,
    recordId,
    fields,
    body,
}: UpdateDataRecordInput) => {
    validateRecordScope(scope);
    validateRecordId(recordId);

    if (
        body === null ||
        typeof body !== "object" ||
        Array.isArray(body)
    ) {
        throw new Error("RUNTIME_INVALID_RECORD_BODY");
    }

    const payload = body as Record<string, unknown>;
    const keys = Object.keys(payload);

    if (keys.length === 0) {
        throw new Error("RUNTIME_EMPTY_RECORD_UPDATE");
    }

    const fieldMap = new Map<string, IAPIModelField>();

    for (const field of fields) {
        if (!isSafeFieldName(field.name)) {
            throw new Error("RUNTIME_UNSAFE_MODEL_FIELD");
        }

        if (fieldMap.has(field.name)) {
            throw new Error("RUNTIME_DUPLICATE_MODEL_FIELD");
        }

        fieldMap.set(field.name, field);
    }

    const updateFields: IAPIModelField[] = [];
    const setValues: Record<string, unknown> =
        Object.create(null);

    for (const key of keys) {
        if (!isSafeFieldName(key)) {
            throw new Error("RUNTIME_UNKNOWN_RECORD_FIELD");
        }

        const field = fieldMap.get(key);

        if (!field) {
            throw new Error("RUNTIME_UNKNOWN_RECORD_FIELD");
        }

        // PATCH validates supplied fields only.
        updateFields.push({
            ...field,
            required: true,
        });

        setValues[`data.${key}`] = payload[key];
    }

    const validationErrors = validateRequestBody({
        body: payload,
        required: true,
        fields: updateFields,
    });

    if (validationErrors.length > 0) {
        const error = new Error(
            "RUNTIME_RECORD_VALIDATION_FAILED"
        );

        Object.assign(error, { validationErrors });
        throw error;
    }

    return APIDataRecord.findOneAndUpdate(
        {
            _id: recordId,
            organizationId: scope.organizationId,
            projectId: scope.projectId,
            apiId: scope.apiId,
            apiVersionId: scope.apiVersionId,
            modelId: scope.modelId,
        },
        {
            $set: setValues,
        },
        {
            returnDocument: "after",
            runValidators: true,
        }
    ).lean();
};

export const deleteDataRecord = async ({
    scope,
    recordId,
}: DeleteDataRecordInput) => {
    validateRecordScope(scope);
    validateRecordId(recordId);

    return APIDataRecord.findOneAndDelete({
        _id: recordId,
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        apiId: scope.apiId,
        apiVersionId: scope.apiVersionId,
        modelId: scope.modelId,
    }).lean();
};

