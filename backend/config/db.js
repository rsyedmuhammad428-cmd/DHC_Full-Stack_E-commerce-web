const mongoose = require("mongoose");

/** Strip wrapping quotes from .env values like MONGO_URI="mongodb://..." */
function cleanMongoUri(raw) {
    if (!raw || typeof raw !== "string") return "";
    let u = raw.trim();
    if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
        u = u.slice(1, -1);
    }
    return u.trim();
}

const connectDB = async () => {
    const uri = cleanMongoUri(process.env.MONGO_URI || "");
    if (!uri) {
        throw new Error("MONGO_URI is missing in .env");
    }

    const preview = uri.replace(/:[^:@/]+@/, ":****@");
    console.log(`Connecting to MongoDB: ${preview.substring(0, 48)}...`);

    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 15000,
        });
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error("Database connection failed:", error.message);
        console.error(
            "Check: Atlas cluster running, Network Access allows your IP (or 0.0.0.0/0), user/password correct, URI has no extra quotes in .env."
        );
        throw error;
    }
};

mongoose.connection.on("error", (err) => {
    console.error(`Mongoose connection error: ${err.message}`);
});

module.exports = connectDB;
