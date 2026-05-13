const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please add a product name"],
            trim: true,
        },
        description: {
            type: String,
            required: [true, "Please add a description"],
        },
        price: {
            type: Number,
            required: [true, "Please add a price"],
        },
        category: {
            type: mongoose.Schema.ObjectId,
            ref: "Category",
            required: true,
        },
        stock: {
            type: Number,
            required: [true, "Please add stock quantity"],
            default: 0,
        },
        images: [
            {
                type: String,
                required: true,
            },
        ],
        ratings: {
            type: Number,
            default: 0,
        },
        numOfReviews: {
            type: Number,
            default: 0,
        },
        user: {
            type: mongoose.Schema.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Product", productSchema);
