import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";

const checkMongoDB = async (): Promise<void> => {
    try {
        await connectDatabase();

        const db = mongoose.connection.db;

        if (!db) {
            throw new Error("MongoDB database connection unavailable");
        }

        const result = await db.admin().command({
            hello: 1,
        });

        if (result.setName) {
            console.log("MongoDB Replica Set:", result.setName);
            console.log("Transactions: Supported");
        } else if (result.msg === "isdbgrid") {
            console.log("MongoDB Sharded Cluster");
            console.log("Transactions: Supported");
        } else {
            console.log("MongoDB Standalone Server");
            console.log("Transactions: Not Supported");
        }
    } catch (error) {
        console.error("MongoDB check failed:", error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

checkMongoDB();