const express = require("express");
const {
    addOrderItems,
    getOrderById,
    getMyOrders,
    getOrders,
    updateOrderStatus,
} = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/")
    .get(protect, authorize("admin"), getOrders)
    .post(protect, addOrderItems);

router.get("/myorders", protect, getMyOrders);

router.route("/:id")
    .get(protect, getOrderById);

router.put("/:id/status", protect, authorize("admin"), updateOrderStatus);

module.exports = router;
