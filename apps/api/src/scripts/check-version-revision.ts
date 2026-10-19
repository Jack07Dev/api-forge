import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import APIVersion from "../models/APIVersion.js";

const main = async () => {
    try {
        await connectDatabase();

        const version = await APIVersion.findById(
            "6ac496fc96251c64b12b4f4a"
        ).select("versionLabel status definitionRevision");

        console.log({
            versionLabel: version?.versionLabel,
            status: version?.status,
            definitionRevision: version?.definitionRevision
        });
    } finally {
        await mongoose.disconnect();
    }
};

main().catch(console.error);