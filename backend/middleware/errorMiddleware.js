const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log to console for dev
    console.error(err);

    // Mongoose bad ObjectId
    if (err.name === "CastError") {
        const message = `Resource not found with id of ${err.value}`;
        error = new Error(message);
        error.statusCode = 404;
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = "Duplicate field value entered";
        error = new Error(message);
        error.statusCode = 400;
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
        const message = Object.values(err.errors).map((val) => val.message);
        error = new Error(message);
        error.statusCode = 400;
    }

    // MongoDB not reachable / connection timeout / buffered ops timeout
    if (
        err.name === "MongoServerSelectionError" ||
        err.name === "MongoNetworkError" ||
        (typeof err.message === "string" &&
            (err.message.includes("buffering timed out") ||
                err.message.includes("Server selection timed out")))
    ) {
        error = new Error(
            "Database is unavailable. Check MongoDB Atlas: cluster running, Network Access IP whitelist, and MONGO_URI in .env."
        );
        error.statusCode = 503;
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Server Error",
    });
};

module.exports = errorHandler;
