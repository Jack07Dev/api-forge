import mongoose from "mongoose";

const TEST_DATABASE_NAME = "api_forge_test";

export const verifyTestDatabase = (): void => {
    const databaseName = mongoose.connection.db?.databaseName;

    if (databaseName !== TEST_DATABASE_NAME) {
        throw new Error(
            `Integration tests blocked: unexpected database ${databaseName ?? "not connected"}`
        );
    }

    console.log(
        `Test database verified: ${databaseName}`
    );
};