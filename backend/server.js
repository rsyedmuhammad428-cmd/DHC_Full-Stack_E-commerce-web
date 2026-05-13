require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorMiddleware");

// Route files
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();

// Connect Database (Vercel serverless approach)
connectDB().catch(err => {
    console.error("Database connection failed:", err.message);
});

// Body parser
app.use(express.json());

// Enable CORS (Allow requests from your frontend)
app.use(cors({
    origin: ["http://127.0.0.1:3000", "http://localhost:3000", "https://dhc-full-stack-e-commerce-web.vercel.app"],
    credentials: true
}));

// Mount routers
app.use("/api/auth", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

app.get("/", (req, res) => {
    res.send("Backend API Running");
});

// Error handler
app.use(errorHandler);

// Keep app.listen ONLY for local development testing
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}

// CRITICAL FOR VERCEL: Export the app instance
module.exports = app;