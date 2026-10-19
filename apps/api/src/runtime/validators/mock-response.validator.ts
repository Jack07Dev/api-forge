export interface MockResponseInput {
    statusCode: unknown;
    responseBody: unknown;
}

export interface ValidMockResponse {
    statusCode: number;
    responseBody: unknown;
}

const MAX_RESPONSE_BYTES = 64 * 1024; // 64 KB

export const validateMockResponse = (
    input: MockResponseInput
): ValidMockResponse => {
    const { statusCode, responseBody } = input;

    if (
        typeof statusCode !== "number" ||
        !Number.isInteger(statusCode) ||
        statusCode < 200 ||
        statusCode > 599
    ) {
        throw new Error("INVALID_MOCK_STATUS_CODE");
    }

    if (
        statusCode === 204 ||
        statusCode === 205 ||
        statusCode === 304
    ) {
        throw new Error("MOCK_STATUS_DOES_NOT_ALLOW_BODY");
    }

    if (
        responseBody === undefined ||
        responseBody === null ||
        typeof responseBody !== "object"
    ) {
        throw new Error("INVALID_MOCK_RESPONSE_BODY");
    }

    let serialized: string;

    try {
        serialized = JSON.stringify(responseBody);

        if (typeof serialized !== "string") {
            throw new Error("INVALID_JSON");
        }
    } catch {
        throw new Error("INVALID_MOCK_RESPONSE_BODY");
    }

    if (
        Buffer.byteLength(serialized, "utf8") >
        MAX_RESPONSE_BYTES
    ) {
        throw new Error("MOCK_RESPONSE_TOO_LARGE");
    }

    return {
        statusCode,
        responseBody: JSON.parse(serialized),
    };
};