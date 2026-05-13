const Product = require("../models/Product");
const mongoose = require("mongoose");

/** Demo catalog used when Mongo has no rows or ID lookup misses (matches storefront slugs where needed). */
const MOCK_PRODUCTS_SEED = [
    {
        _id: "507f1f77bcf86cd799439011",
        name: "Smart Watch Pro",
        price: 199,
        description: "Premium smart watch with fitness tracking and long battery life.",
        images: ["https://i.postimg.cc/BtQD2Vqk/4.jpg"],
        ratings: 4.6,
        numOfReviews: 128,
        category: { name: "Electronics" },
    },
    {
        _id: "507f1f77bcf86cd799439012",
        name: "Kitchen Mixer Deluxe",
        price: 100,
        description: "High-speed mixer with multiple presets for baking and smoothies.",
        images: ["https://images.unsplash.com/photo-1594819047050-99defca82545?auto=format&fit=crop&w=900&q=80"],
        ratings: 4.4,
        numOfReviews: 56,
        category: { name: "Home & Living" },
    },
];

function getMockProductById(id) {
    return MOCK_PRODUCTS_SEED.find((p) => String(p._id) === String(id)) || null;
}

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
    try {
        let products = [];
        
        // Only query DB if connected, otherwise use empty array to trigger mock data
        if (mongoose.connection.readyState === 1) {
            products = await Product.find().populate("category", "name");
        }

        // Mock data if no products found in DB or DB not connected

        if (products.length === 0) {
            products = MOCK_PRODUCTS_SEED.map((p) => ({ ...p }));
        }

        res.status(200).json({
            success: true,
            count: products.length,
            data: products,
        });
    } catch (err) {
        next(err);
    }
};


// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = async (req, res, next) => {
    try {
        let product = await Product.findById(req.params.id).populate(
            "category",
            "name"
        );

        if (!product) {
            const mock = getMockProductById(req.params.id);
            if (!mock) {
                return res.status(404).json({
                    success: false,
                    error: "Product not found",
                });
            }
            product = mock;
        }

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (err) {
        if (err.name === "CastError") {
            const mock = getMockProductById(req.params.id);
            if (mock) {
                return res.status(200).json({
                    success: true,
                    data: mock,
                });
            }
        }
        next(err);
    }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res, next) => {
    try {
        req.body.user = req.user.id;

        const product = await Product.create(req.body);

        res.status(201).json({
            success: true,
            data: product,
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res, next) => {
    try {
        let product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: "Product not found",
            });
        }

        product = await Product.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            success: true,
            data: product,
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: "Product not found",
            });
        }

        await product.deleteOne();

        res.status(200).json({
            success: true,
            data: {},
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
};
