const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api' 
    : '/api';
// Helper function to handle fetch calls
const apiCall = async (endpoint, method = "GET", body = null, token = null) => {
    const headers = {
        "Content-Type": "application/json",
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("API Call Error:", error);
        return { success: false, error: error.message };
    }
};

// --- Examples of Usage ---

// 1. Get all products
const fetchProducts = async () => {
    const res = await apiCall("/products");
    if (res.success) {
        console.log("Products:", res.data);
        // Here you would render products to your HTML
    }
};

// 2. User Login
const loginUser = async (email, password) => {
    const res = await apiCall("/auth/login", "POST", { email, password });
    if (res.success) {
        localStorage.setItem("token", res.token);
        alert("Login Successful!");
    } else {
        alert(res.error);
    }
};

// 3. Create Product (Admin Only)
const addProduct = async (productData) => {
    const token = localStorage.getItem("token");
    const res = await apiCall("/products", "POST", productData, token);
    if (res.success) {
        console.log("Product Added:", res.data);
    }
};

// Exporting if using modules, or just keeping global
// export { fetchProducts, loginUser, addProduct };
