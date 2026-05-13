/** Max price slider / default filter ceiling (premium SKUs exceed $4k). */
const DEFAULT_PRICE_CEILING = 8000;

/** Preset sidebar chips (merged with catalog at runtime). */
const CATEGORY_WHITELIST = new Set([
    'Mobile Phones', 'Laptops', 'Tablets', 'Audio Gear', 'Cameras',
    'Home & Living', 'Fashion', 'Wearables', 'Electronics', 'General',
]);
const CATEGORY_PRESET = [...CATEGORY_WHITELIST].sort((a, b) => a.localeCompare(b));

let catalog = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let saved = JSON.parse(localStorage.getItem('savedForLater') || '[]');
let filters = {
    category: 'all',
    brands: [],
    priceRange: [0, DEFAULT_PRICE_CEILING],
    verifiedOnly: false,
    sort: 'featured',
};

const API_URL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api' 
    : '/api';
const STORAGE_USER_KEY = 'ec_user';

const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
const money = (n) => `$${Number(n).toFixed(2)}`;

const urlParam = (k) => new URLSearchParams(window.location.search).get(k);

function urlParamDecoded(k) {
    const v = new URLSearchParams(window.location.search).get(k);
    if (v === null || v === '') return '';
    try {
        return decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
        return v;
    }
}

/** Last path segment, case-preserved (e.g. products.html). */
function pathTail() {
    const p = window.location.pathname || '';
    const seg = p.split('/').filter(Boolean);
    return seg.length ? seg[seg.length - 1] : '';
}

function isProductsPage() {
    return /^products\.html$/i.test(pathTail());
}

function isProductDetailPage() {
    return /^product-detail\.html$/i.test(pathTail());
}

function isCartPage() {
    return /^cart\.html$/i.test(pathTail());
}

function isCheckoutPage() {
    return /^checkout\.html$/i.test(pathTail());
}

function isLoginPage() {
    return /^login\.html$/i.test(pathTail());
}

function isRegisterPage() {
    return /^register\.html$/i.test(pathTail());
}

function isOrdersPage() {
    return /^orders\.html$/i.test(pathTail());
}

function isIndexPage() {
    const p = window.location.pathname || '';
    if (p === '/' || p === '') return true;
    return /^index\.html$/i.test(pathTail());
}

/** Non-blocking fetch — avoids hung UI when API is down. */
async function fetchWithTimeout(url, options = {}, ms = 5000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
        clearTimeout(t);
    }
}

function bootstrapCatalogSync() {
    catalog = buildSeedCatalog();
    if (!catalog.length) {
        console.error('Catalog is empty: ensure catalog-products.js loads before script.js');
    }
}

function findProductInCatalog(id) {
    const k = String(id || '').trim();
    const inMem = catalog.find((i) => String(i.id) === k);
    if (inMem) return inMem;
    return findProductById(k);
}

function escAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function canonicalCategory(input) {
    const raw = (typeof input === 'string' ? input : input?.name ?? '').trim();
    if (!raw) return 'Electronics';
    if (CATEGORY_WHITELIST.has(raw)) return raw;

    const l = raw.toLowerCase().replace(/\s+/g, ' ');
    if (/(phone|smartphone|android\s*mobile|mobile\s+phone|\bgsm\b)/.test(l)) return 'Mobile Phones';
    if (/(laptop|notebook|chromebook|\bmacbook\b)/.test(l)) return 'Laptops';
    if (/(tablet|\bipad\b)/.test(l)) return 'Tablets';
    if (/(headphone|earbud|\bairpods\b|\bheadset\b|speaker|noise\s*cancell|soundbar)/.test(l)) return 'Audio Gear';
    if (/(\bcamera\b|mirrorless|\bdslr\b|\blens\b)/.test(l)) return 'Cameras';
    if (/(watch|\btracker\b|\bband\b|wearable|\bbing\b)/.test(l)) return 'Wearables';
    if (/(home|kitchen|furniture|living|decor|bedroom|lamps?\b|cushion|sofa|cookware)/.test(l)) return 'Home & Living';
    if (/(polo|shirt|jacket|shoe|sneaker|bag|belt|dress|fabric|runner|trainer|wallet|polo)/.test(l)) return 'Fashion';

    return 'Electronics';
}

function normalizeSeedProduct(seed) {
    const imgs = Array.isArray(seed.images) && seed.images.length ? seed.images : [seed.image];
    return {
        id: seed.id,
        name: seed.name,
        price: Number(seed.price),
        oldPrice: seed.oldPrice ?? Math.round(Number(seed.price) * 1.06),
        rating: typeof seed.rating === 'number' ? seed.rating : 4.7,
        reviews: seed.reviews ?? Math.max(32, Math.floor(Number(seed.price) / 9)),
        sold: seed.sold ?? Math.min(8000, 100 + Math.floor(Number(seed.price) / 4)),
        image: seed.image || imgs[0],
        images: imgs,
        category: canonicalCategory(seed.category),
        brand: seed.brand || 'Brand',
        desc: seed.desc ?? '',
        verified: seed.verified !== false,
    };
}

/** Baseline SKU list from catalog-products.js (window.STORE_PRODUCTS). */
function seedProductSource() {
    return typeof STORE_PRODUCTS !== 'undefined' && Array.isArray(STORE_PRODUCTS) ? STORE_PRODUCTS : [];
}

function buildSeedCatalog() {
    return seedProductSource().map(normalizeSeedProduct);
}

function findProductById(idRaw) {
    const id = String(idRaw || '').trim();
    let p = catalog.find((x) => String(x.id) === id);
    if (p) return { ...p };
    const fallback = seedProductSource().find((x) => String(x.id) === id);
    return fallback ? normalizeSeedProduct(fallback) : null;
}

function getStoredToken() {
    return localStorage.getItem('token');
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_USER_KEY) || 'null');
    } catch {
        return null;
    }
}

function setAuth(token, user) {
    if (token) localStorage.setItem('token', token); else localStorage.removeItem('token');
    if (user) localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user)); else localStorage.removeItem(STORAGE_USER_KEY);
}

function mergedCategoryLabels() {
    const fromCatalog = [...new Set(catalog.map((p) => p.category).filter(Boolean))];
    const merged = [...new Set([...CATEGORY_PRESET, ...fromCatalog])].sort((a, b) => a.localeCompare(b));
    return merged;
}

function mapApiProduct(p) {
    const images = Array.isArray(p.images) && p.images.length ? p.images : ['https://via.placeholder.com/300'];
    const id = String(p._id ?? p.id);
    return {
        id,
        name: p.name,
        price: Number(p.price),
        oldPrice: p.oldPrice ?? Math.round(Number(p.price) * 1.05),
        rating: typeof p.ratings === 'number' ? p.ratings : 4.5,
        reviews: p.numOfReviews ?? 0,
        sold: typeof p.numOfReviews === 'number' && p.numOfReviews > 0
            ? Math.min(99999, 80 + p.numOfReviews * 15)
            : (p.sold ?? 520),
        image: images[0],
        images,
        category: canonicalCategory(p.category?.name ?? p.category),
        brand: p.brand ?? 'Generic',
        desc: (p.description ?? '').trim(),
        verified: true,
    };
}

async function hydrateCatalog() {
    const seeded = buildSeedCatalog();
    if (!catalog.length) catalog = seeded;

    try {
        const res = await fetchWithTimeout(`${API_URL}/products`, {}, 6000);
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            const fromApi = data.data.map(mapApiProduct);
            const seenIds = new Set(fromApi.map((x) => String(x.id)));
            catalog = [...fromApi, ...seeded.filter((s) => !seenIds.has(String(s.id)))];
        }
    } catch (e) {
        console.warn('Catalog API skipped — using local catalog.', e?.name === 'AbortError' ? '(timeout)' : e?.message || '');
        if (!catalog.length) catalog = seeded;
    }
}

async function enrichProductFromApi(id) {
    try {
        const res = await fetchWithTimeout(`${API_URL}/products/${encodeURIComponent(id)}`, {}, 4500);
        const data = await res.json();
        if (data.success && data.data) return mapApiProduct(data.data);
    } catch (_) { /* use local product */ }
    return null;
}

function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 300); }, 2200);
}

function computeCartTotals(cartArr = cart) {
    const subtotal = cartArr.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
    const discount = subtotal > 500 ? 60 : 0;
    const tax = subtotal ? 14 : 0;
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, discount, tax, total };
}

async function apiJson(endpoint, method = 'GET', body = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && getStoredToken()) headers.Authorization = `Bearer ${getStoredToken()}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_URL}${endpoint}`, opts);
    let data = {};
    try {
        data = await res.json();
    } catch {
        data = {};
    }
    return { ok: res.ok, status: res.status, data };
}

function renderShell() {
    const header = qs('#site-header');
    const footer = qs('#site-footer');
    const user = getStoredUser();
    const cats = mergedCategoryLabels();
    const catOptions = cats.map((c) => `<option value="${c}">${c}</option>`).join('');
    const accountHref = user ? 'orders.html' : 'login.html';
    const accountLabel = user ? (user.name || 'Account').split(' ')[0] : 'Sign in';

    if (header) header.innerHTML = `
        <header class="site-header">
            <div class="container header-top">
                <a href="index.html" class="logo brand-wordmark"><img src="https://i.postimg.cc/ZK1C7Zyv/logo-symbol.png" alt="Brand Logo"><span>Brand</span></a>
                <button class="menu-toggle" type="button" aria-label="Toggle navigation"><i class="fas fa-bars"></i></button>
                <div class="search-bar">
                    <input class="search-input" type="text" placeholder="Search">
                    <select class="search-category-select">
                        <option value="all">All category</option>
                        ${catOptions}
                    </select>
                    <button class="btn-search" type="button">Search</button>
                </div>
                <div class="header-actions">
                    <a href="${accountHref}" class="action-item" aria-label="Account"><i class="fas fa-user"></i><span>${accountLabel}</span></a>
                    <a href="products.html" class="action-item"><i class="fas fa-comment-dots"></i><span>Message</span></a>
                    <a href="orders.html" class="action-item"><i class="fas fa-receipt"></i><span>Orders</span></a>
                    <a href="cart.html" class="action-item"><i class="fas fa-shopping-cart"></i><span>My cart</span><span class="cart-badge">0</span></a>
                    ${user ? `<button type="button" class="btn btn-outline header-logout" style="margin-left:8px;padding:8px 12px;font-size:13px;">Log out</button>` : ''}
                </div>
            </div>
            <nav class="nav-bar">
                <div class="container nav-content">
                    <ul class="nav-links">
                        <li class="all-category"><a href="products.html"><i class="fas fa-bars"></i> All category</a></li>
                        <li><a href="products.html?cat=Mobile%20Phones">Hot offers</a></li>
                        <li><a href="products.html?cat=Home%20%26%20Living">Gift boxes</a></li>
                        <li><a href="products.html?cat=Laptops">Projects</a></li>
                        <li><a href="products.html">Menu item</a></li>
                        <li><a href="products.html">Help <i class="fas fa-chevron-down"></i></a></li>
                    </ul>
                    <div class="nav-right">
                        <div class="currency"><span>English, USD</span><i class="fas fa-chevron-down"></i></div>
                        <div class="ship-to ship-brand"><img src="https://i.postimg.cc/ZK1C7Zyv/logo-symbol.png" alt="Brand Logo"><span>Brand</span><i class="fas fa-chevron-down"></i></div>
                    </div>
                </div>
            </nav>
        </header>`;
    if (footer) footer.innerHTML = `
        <footer>
            <div class="container">
                <div class="footer-top">
                    <div class="footer-brand">
                        <a href="index.html" class="logo brand-wordmark"><img src="https://i.postimg.cc/ZK1C7Zyv/logo-symbol.png" alt="Brand Logo"><span>Brand</span></a>
                        <p>Best information about the company gies here but now lorem ipsum is</p>
                        <div class="social-links">
                            <a href="https://facebook.com" target="_blank" rel="noreferrer"><i class="fab fa-facebook-f"></i></a>
                            <a href="https://twitter.com" target="_blank" rel="noreferrer"><i class="fab fa-twitter"></i></a>
                            <a href="https://linkedin.com" target="_blank" rel="noreferrer"><i class="fab fa-linkedin-in"></i></a>
                            <a href="https://instagram.com" target="_blank" rel="noreferrer"><i class="fab fa-instagram"></i></a>
                            <a href="https://youtube.com" target="_blank" rel="noreferrer"><i class="fab fa-youtube"></i></a>
                        </div>
                    </div>
                    <div class="footer-column"><h4>About</h4><ul><li><a href="index.html">About Us</a></li><li><a href="products.html">Find store</a></li><li><a href="products.html">Categories</a></li><li><a href="products.html">Blogs</a></li></ul></div>
                    <div class="footer-column"><h4>Partnership</h4><ul><li><a href="products.html">About Us</a></li><li><a href="products.html">Find store</a></li><li><a href="products.html">Categories</a></li><li><a href="products.html">Blogs</a></li></ul></div>
                    <div class="footer-column"><h4>Information</h4><ul><li><a href="products.html">Help Center</a></li><li><a href="cart.html">Money Refund</a></li><li><a href="products.html">Shipping</a></li><li><a href="products.html">Contact us</a></li></ul></div>
                    <div class="footer-column"><h4>For users</h4><ul><li><a href="login.html">Login</a></li><li><a href="register.html">Register</a></li><li><a href="products.html">Settings</a></li><li><a href="orders.html">My Orders</a></li></ul></div>
                    <div class="footer-column app-links"><h4>Get app</h4><a href="#"><img src="https://i.postimg.cc/0rWSn0j8/6.png" alt="App Store"></a><a href="#"><img src="https://i.postimg.cc/YjqgQsps/3.png" alt="Google Play"></a></div>
                </div>
            </div>
            <div class="footer-bottom"><div class="container footer-bottom-content"><p>&copy; 2026 Ecommerce.</p><div class="footer-settings"><img src="https://i.postimg.cc/ZK1C7Zyv/logo-symbol.png" alt="Brand Logo"><span>Brand</span><i class="fas fa-chevron-up"></i></div></div></div>
        </footer>`;

    const lg = qs('.header-logout');
    if (lg) lg.addEventListener('click', () => {
        setAuth(null, null);
        toast('Signed out.');
        window.location.href = 'index.html';
    });
}

function initHeader() {
    const header = qs('.site-header');
    const nav = qs('.nav-bar');
    const toggle = qs('.menu-toggle');
    if (header) window.addEventListener('scroll', () => header.classList.toggle('is-scrolled', window.scrollY > 10));
    if (toggle && nav) toggle.addEventListener('click', () => nav.classList.toggle('active'));
}

function doSearch() {
    const params = new URLSearchParams();
    const q = qs('.search-input')?.value.trim();
    const cat = qs('.search-category-select')?.value || 'all';
    if (q) params.set('search', q);
    if (cat !== 'all') params.set('cat', cat);
    window.location.href = `products.html${params.toString() ? `?${params}` : ''}`;
}

function initSearch() {
    const input = qs('.search-input');
    const select = qs('.search-category-select');
    const btn = qs('.btn-search');
    if (!input || !select || !btn) return;
    const sQ = urlParamDecoded('search') || urlParam('search');
    const cQ = urlParamDecoded('cat') || urlParam('cat');
    if (sQ) input.value = sQ;
    if (cQ) select.value = cQ;
    btn.addEventListener('click', doSearch);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
}

function card(p) {
    const pidEsc = escAttr(String(p.id));
    const descPlain = String(p.desc || '').replace(/</g, '').replace(/\r?\n/g, ' ');
    return `<div class="card product-card" data-product-id="${pidEsc}" role="button" tabindex="0">${p.oldPrice > p.price ? '<div class="sale-badge">SALE</div>' : ''}<div class="product-img-wrapper"><img src="${escAttr(String(p.image))}" alt="${escAttr(p.name)}"></div><div class="product-content"><div class="rating"><i class="fas fa-star"></i><span>${p.rating}</span></div><p class="product-name">${escAttr(p.name)}</p><div class="price-row"><div><span class="price">${money(p.price)}</span>${p.oldPrice ? `<span class="old-price">${money(p.oldPrice)}</span>` : ''}</div><i class="far fa-heart heart-icon" onclick="togWl(this, event)"></i></div><p class="product-desc" style="display:none;">${escAttr(descPlain)}</p></div><div class="product-actions" style="display:none;"><button type="button" class="btn btn-primary" onclick="addByProd('${String(p.id).replace(/'/g, "\\'")}', event)">Add to cart</button><button type="button" class="btn btn-outline" onclick="saveProductForLater('${String(p.id).replace(/'/g, "\\'")}', event)">Wishlist</button></div></div>`;
}

function renderGrid(id, list) {
    const el = qs(`#${id}`);
    if (el) el.innerHTML = list.map(card).join('');
}

function syncPriceUi() {
    const [min, max] = filters.priceRange;
    if (qs('#price-min')) qs('#price-min').value = min;
    if (qs('#price-max')) {
        qs('#price-max').max = String(DEFAULT_PRICE_CEILING);
        qs('#price-max').value = Math.min(Number(max), DEFAULT_PRICE_CEILING);
    }
    if (qs('#price-range-slider')) {
        qs('#price-range-slider').max = String(DEFAULT_PRICE_CEILING);
        qs('#price-range-slider').value = Math.min(Number(max), DEFAULT_PRICE_CEILING);
    }
}

function updateCartIcons() {
    const total = cart.reduce((s, i) => s + i.quantity, 0);
    qsa('.cart-badge').forEach((el) => {
        el.textContent = total;
        el.style.display = total ? 'inline-block' : 'none';
    });
}

function saveState() {
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('savedForLater', JSON.stringify(saved));
    updateCartIcons();
}

function addToCart(product) {
    const found = cart.find((i) => String(i.id) === String(product.id));
    if (found) found.quantity += 1; else cart.push({ id: product.id, name: product.name, price: Number(product.price), image: product.image || product.images?.[0], quantity: 1 });
    saveState();
    renderCart();
    renderSavedLater();
    toast('Product added to cart!');
}

function removeFromCart(id) {
    cart = cart.filter((i) => String(i.id) !== String(id));
    saveState();
    renderCart();
    renderSavedLater();
}

function updateQty(id, qty) {
    const item = cart.find((i) => String(i.id) === String(id));
    if (item) {
        item.quantity = Number(qty);
        saveState();
        renderCart();
    }
}

function clearCart() {
    cart = [];
    saveState();
    renderCart();
    toast('Cart cleared.');
}

function saveProductForLater(id, e) {
    if (e) e.stopPropagation();
    const p = findProductInCatalog(id);
    if (p && !saved.some((i) => String(i.id) === String(id))) {
        saved.push({ ...p });
        saveState();
        renderSavedLater();
    }
    toast('Saved for later.');
}

function saveCartItemForLater(id) {
    saveProductForLater(id);
    removeFromCart(id);
}

function togWl(btn, e) {
    if (e) e.stopPropagation();
    btn.classList.toggle('fas');
    btn.classList.toggle('far');
    btn.style.color = btn.classList.contains('fas') ? '#eb001b' : '#0d6efd';
}

function openDetail(id) {
    window.location.href = `product-detail.html?id=${encodeURIComponent(String(id || '').trim())}`;
}

function navigateFromProductTile(e) {
    const node = e.target.closest('[data-product-id]');
    if (!node) return;
    if (node.closest('#site-header, #site-footer')) return;
    if (e.target.closest('button, label, input, textarea, select, .heart-icon, a[href]')) return;
    const pid = node.getAttribute('data-product-id');
    if (!pid) return;
    openDetail(pid);
}

function onProductTileKeyNavigate(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest('[data-product-id]');
    if (!t || (!t.classList.contains('product-card') && !t.classList.contains('related-tile'))) return;
    if (e.target.closest('button, .heart-icon')) return;
    e.preventDefault();
    openDetail(t.getAttribute('data-product-id'));
}

function initProductNavigateDelegation() {
    document.body.addEventListener('click', navigateFromProductTile);
    document.body.addEventListener('keydown', onProductTileKeyNavigate);
}

function addByProd(id, e) {
    if (e) e.stopPropagation();
    const p = findProductInCatalog(id);
    if (p) addToCart(p);
}

function setView(btn, mode) {
    const box = qs('#product-listing-grid');
    if (!box) return;
    box.classList.toggle('product-list', mode === 'list');
    box.classList.toggle('product-grid', mode !== 'list');
    qsa('button', btn.parentElement).forEach((b) => { b.style.background = 'white'; });
    btn.style.background = '#eee';
}

function renderCategorySidebar() {
    const box = qs('#category-filter-list');
    if (!box) return;
    const labels = mergedCategoryLabels();
    box.innerHTML = `<li data-ch="all" data-category="all" style="cursor: pointer;">All Products</li>${
        labels.map((cat) => `<li data-ch="${encodeURIComponent(cat)}" data-category="${encodeURIComponent(cat)}" style="cursor: pointer;">${cat.replace(/</g, '')}</li>`).join('')
    }`;
    box.onclick = (e) => {
        const li = e.target.closest('li[data-ch]');
        if (!li) return;
        const raw = decodeURIComponent(li.dataset.ch);
        filterByCat(raw === 'all' ? 'all' : raw);
    };
}

function renderBrandFilters() {
    const ul = qs('#brand-filter-list');
    if (!ul) return;
    const brands = [...new Set(catalog.map((p) => p.brand).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    ul.innerHTML = brands.map((b) =>
        `<li><label style="cursor:pointer;display:flex;align-items:center;gap:10px;line-height:1.4;">
      <input type="checkbox" data-bc="${encodeURIComponent(String(b))}">
      <span>${String(b).replace(/</g, '')}</span>
    </label></li>`).join('');
    ul.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.addEventListener('change', () => {
        const label = decodeURIComponent(cb.dataset.bc || '');
        filterByBrand(label, cb.checked);
    }));
}

function getFiltered() {
    let list = [...catalog];
    let catFlag = filters.category !== 'all' ? filters.category : '';
    if (!catFlag) catFlag = urlParamDecoded('cat') || '';
    const catEffective = catFlag.trim() !== '' ? catFlag.trim() : 'all';
    const q = (urlParamDecoded('search') || urlParam('search') || '').toLowerCase().trim();
    if (catEffective !== 'all') list = list.filter((p) => p.category === catEffective);
    if (filters.brands.length) list = list.filter((p) => filters.brands.includes(p.brand));
    if (filters.verifiedOnly) list = list.filter((p) => p.verified);
    list = list.filter((p) => p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]);
    if (q) list = list.filter((p) => [p.name, p.category, p.brand, p.desc || ''].join(' ').toLowerCase().includes(q));
    if (filters.sort === 'price-low') list.sort((a, b) => a.price - b.price);
    else if (filters.sort === 'price-high') list.sort((a, b) => b.price - a.price);
    else if (filters.sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    else list.sort((a, b) => (b.sold || 0) - (a.sold || 0));
    return list;
}

function filterChip(type, label) {
    return `<span class="active-filter-chip" onclick="removeFilterChip('${type}','${label.replace(/'/g, "\\'")}')">${label} <i class="fas fa-times" style="margin-left:10px;"></i></span>`;
}

function updateProductUi(list) {
    let catFlag = filters.category !== 'all' ? filters.category : '';
    if (!catFlag) catFlag = urlParamDecoded('cat') || '';
    const cat = catFlag.trim() !== '' ? catFlag.trim() : 'all';
    if (qs('#results-count')) qs('#results-count').textContent = list.length;
    if (qs('#results-category')) qs('#results-category').textContent = cat === 'all' ? 'All Products' : cat;
    qsa('#category-filter-list [data-ch]').forEach((li) => {
        const val = li.dataset.ch === 'all' ? 'all' : decodeURIComponent(li.dataset.ch || '');
        const isActive = val === cat || (cat === 'all' && val === 'all');
        li.style.color = isActive ? 'var(--primary-color)' : 'var(--gray-color)';
        li.style.fontWeight = isActive ? '600' : 'normal';
    });
    if (qs('#active-filters')) {
        const chips = [];
        if (cat !== 'all') chips.push(filterChip('category', cat));
        filters.brands.forEach((b) => chips.push(filterChip('brand', b)));
        if (filters.verifiedOnly) chips.push(filterChip('verified', 'Verified only'));
        if (filters.priceRange[0] !== 0 || filters.priceRange[1] !== DEFAULT_PRICE_CEILING) chips.push(filterChip('price', `$${filters.priceRange[0]} - $${filters.priceRange[1]}`));
        chips.push('<span onclick="clearF()" style="color: var(--primary-color); cursor: pointer; align-self: center;">Clear all filter</span>');
        qs('#active-filters').innerHTML = chips.join('');
    }
}

function applyAllFilters() {
    const list = getFiltered();
    renderGrid('product-listing-grid', list);
    updateProductUi(list);
}

function filterByCat(cat) {
    filters.category = cat;
    const url = new URL(window.location.href);
    if (cat === 'all') url.searchParams.delete('cat'); else url.searchParams.set('cat', cat);
    history.replaceState({}, '', url);
    applyAllFilters();
}

function filterByBrand(brand, checked) {
    filters.brands = checked ? [...new Set([...filters.brands, brand])] : filters.brands.filter((b) => b !== brand);
    applyAllFilters();
}

function removeFilterChip(type, label) {
    if (type === 'category') filterByCat('all');
    if (type === 'brand') {
        filters.brands = filters.brands.filter((b) => b !== label);
        qsa('#brand-filter-list input[type="checkbox"]').forEach((cb) => {
            try {
                if (decodeURIComponent(cb.dataset.bc || '') === label) cb.checked = false;
            } catch (_) { /* noop */ }
        });
        applyAllFilters();
    }
    if (type === 'verified') {
        filters.verifiedOnly = false;
        if (qs('#verified-only')) qs('#verified-only').checked = false;
        applyAllFilters();
    }
    if (type === 'price') {
        filters.priceRange = [0, DEFAULT_PRICE_CEILING];
        syncPriceUi();
        applyAllFilters();
    }
}

function clearF() {
    filters = { category: 'all', brands: [], priceRange: [0, DEFAULT_PRICE_CEILING], verifiedOnly: false, sort: 'featured' };
    qsa('#brand-filter-list input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
    const url = new URL(window.location.href);
    url.searchParams.delete('cat');
    history.replaceState({}, '', url);
    if (qs('#sort-select')) qs('#sort-select').value = 'featured';
    syncPriceUi();
    applyAllFilters();
}

function initProducts() {
    if (!isProductsPage()) return;
    renderCategorySidebar();
    renderBrandFilters();
    const catQ = urlParamDecoded('cat');
    if (catQ) filters.category = catQ;
    if (qs('#sort-select')) qs('#sort-select').addEventListener('change', (e) => { filters.sort = e.target.value; applyAllFilters(); });
    if (qs('#verified-only')) qs('#verified-only').addEventListener('change', (e) => { filters.verifiedOnly = e.target.checked; applyAllFilters(); });
    if (qs('#price-range-slider')) qs('#price-range-slider').addEventListener('input', (e) => { filters.priceRange[1] = Number(e.target.value); syncPriceUi(); });
    if (qs('#price-apply')) qs('#price-apply').addEventListener('click', () => {
        const min = Math.max(0, Number(qs('#price-min').value || 0));
        const max = Math.max(min, Number(qs('#price-max').value || DEFAULT_PRICE_CEILING));
        filters.priceRange = [min, max];
        syncPriceUi();
        applyAllFilters();
    });
    if (qs('#filters-toggle') && qs('.filters-sidebar')) qs('#filters-toggle').addEventListener('click', () => qs('.filters-sidebar').classList.toggle('filters-open'));
    applyAllFilters();
}

function renderDetailGalleryImages(images) {
    const wrap = qs('.detail-thumbnails');
    const mainImg = qs('#main-product-image');
    if (!wrap || !mainImg) return;
    const uniq = [...new Set((images || []).filter(Boolean))];
    if (!uniq.length) uniq.push(mainImg.src);
    wrap.innerHTML = uniq.map((src, idx) =>
        `<img class="detail-thumb ${idx === 0 ? 'active' : ''}" data-image="${src.replace(/"/g, '')}" src="${src.replace(/"/g, '')}" alt="" style="width: 60px; height: 60px; border: 2px solid ${idx === 0 ? 'var(--primary-color)' : 'var(--border-color)'}; padding: 5px; border-radius: 4px; cursor: pointer;">`
    ).join('');
    mainImg.src = uniq[0];
    qsa('.detail-thumb').forEach((thumb) => thumb.addEventListener('click', () => {
        qsa('.detail-thumb').forEach((t) => {
            t.classList.remove('active');
            t.style.borderColor = 'var(--border-color)';
        });
        thumb.classList.add('active');
        thumb.style.borderColor = 'var(--primary-color)';
        qs('#main-product-image').src = thumb.dataset.image || thumb.src;
    }));
}

function renderRelatedCarousel(currentId) {
    const holder = qs('#related-products-grid');
    if (!holder) return;
    const anchor =
        catalog.find((x) => String(x.id) === String(currentId))
        || findProductById(currentId);
    const catKey = anchor?.category;
    let pool = catalog.filter((x) => String(x.id) !== String(currentId));
    if (catKey) {
        const same = pool.filter((x) => x.category === catKey);
        if (same.length >= 3) pool = same;
    }
    const others = pool.slice(0, 6);
    holder.innerHTML = others.map((p) => `
        <div class="related-item related-tile" data-product-id="${escAttr(String(p.id))}" role="button" tabindex="0">
            <img src="${escAttr(String(p.image))}" alt="${escAttr(p.name)}">
            <p>${escAttr(p.name)}</p>
            <span>${money(p.price)}</span>
        </div>`).join('');
}

function showDetailNotFound(requestedId) {
    const mainEl = qs('main.container') || qs('main');
    if (mainEl) {
        mainEl.innerHTML =
            `<div class="card" style="margin-top:28px;padding:40px;text-align:center;">`
            + '<h2 style="font-weight:700;margin-bottom:16px;color:var(--dark-color);">Product not available</h2>'
            + '<p style="color:var(--gray-color);max-width:480px;margin:0 auto 24px;line-height:1.6;">'
            + 'We couldn’t open this listing. Product ID:'
            + ` <strong style="color:var(--dark-color);word-break:break-all;">${escAttr(String(requestedId || '—'))}</strong>. `
            + 'Your link may be out of date, or the SKU was removed.'
            + '</p>'
            + `<a href="products.html" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:8px;"><i class="fas fa-arrow-left"></i>Browse catalogue</a></div>`;
    }
}

let detailTabsBound = false;

function bindDetailTabsOnce() {
    const wrap = qs('.detail-tabs');
    if (!wrap || detailTabsBound) return;
    detailTabsBound = true;
    wrap.addEventListener('click', (e) => {
        const tab = e.target.closest('.detail-tab');
        if (!tab) return;
        const key = tab.dataset.tab;
        qsa('.detail-tab').forEach((t) => {
            t.classList.toggle('active', t === tab);
            t.style.color = t === tab ? 'var(--primary-color)' : 'var(--gray-color)';
            t.style.borderBottomColor = t === tab ? 'var(--primary-color)' : 'transparent';
            t.style.fontWeight = t === tab ? '600' : 'normal';
        });
        qsa('.detail-tab-panel').forEach((pnl) => {
            pnl.style.display = pnl.dataset.panel === key ? 'block' : 'none';
        });
    });
}

function fillDetailPrimarySpec(p) {
    const grids = qsa('.detail-info .info-grid');
    const g = grids[0];
    if (g) {
        g.innerHTML = `
            <div style="color: var(--gray-color);">Category:</div><div>${escAttr(p.category)}</div>
            <div style="color: var(--gray-color);">Brand:</div><div>${escAttr(p.brand)}</div>
            <div style="color: var(--gray-color);">SKU:</div><div>${escAttr(p.id)}</div>
            <div style="color: var(--gray-color);">Availability:</div><div>In stock · Ships in 2–4 business days</div>`;
    }
}

function applyProductDetailToDom(p) {
    if (!p) return;
    document.title = `${p.name.replace(/</g, '')} - Brand`;

    const images = [...(Array.isArray(p.images) ? p.images : [])];
    if (p.image && !images.includes(p.image)) images.unshift(p.image);

    const h = qs('.detail-info h1') || qs('h1');
    if (h) h.textContent = p.name;

    renderDetailGalleryImages(images);

    const stats = qs('#detail-rating-strip');
    if (stats) {
        stats.innerHTML = `
            <div style="color: #ff9017; font-size: 14px;">
                <i class="fas fa-star"></i><span style="margin-left: 4px;font-weight:600;">${Number(p.rating).toFixed(1)}</span>
            </div>
            <div style="color: var(--gray-color); font-size: 14px;"><i class="fas fa-comment"></i> ${p.reviews} reviews</div>
            <div style="color: var(--gray-color); font-size: 14px;"><i class="fas fa-shopping-basket"></i> ${p.sold ?? 0} sold</div>`;
    }

    const navSpan = qs('.breadcrumb-current');
    if (navSpan) navSpan.textContent = p.name;

    const descTab = qs('.detail-tab-panel[data-panel="description"]');
    if (descTab) {
        const lead = (p.desc && p.desc.trim())
            ? `<p style="color: var(--gray-color); margin-bottom: 20px;">${p.desc.replace(/</g, '')}</p>`
            : '';
        const rest = [...descTab.querySelectorAll('table, ul')].map((n) => n.outerHTML).join('');
        descTab.innerHTML = `${lead}${rest || '<p style="color: var(--gray-color);">Premium quality with manufacturer-backed support.</p>'}`;
    }

    if (qs('#product-price-1')) qs('#product-price-1').textContent = money(p.price);
    if (qs('#product-price-2')) qs('#product-price-2').textContent = money(p.price * 0.92);
    if (qs('#product-price-3')) qs('#product-price-3').textContent = money(p.price * 0.85);

    fillDetailPrimarySpec(p);

    const addBtn = qs('#detail-add-to-cart');
    if (addBtn) {
        const fresh = addBtn.cloneNode(true);
        addBtn.replaceWith(fresh);
        fresh.addEventListener('click', () => addToCart(p));
    }
    const saveBtn = qs('#detail-save-button');
    if (saveBtn) {
        const freshSb = saveBtn.cloneNode(true);
        saveBtn.replaceWith(freshSb);
        freshSb.addEventListener('click', () => saveProductForLater(p.id));
    }

    bindDetailTabsOnce();
    renderRelatedCarousel(p.id);
    qs('.detail-layout')?.classList.add('detail-loaded');
}

async function initDetail() {
    if (!isProductDetailPage()) return;
    const id = urlParamDecoded('id') || urlParam('id');
    const idTrim = String(id || '').trim();
    if (!idTrim) {
        showDetailNotFound('');
        return;
    }

    let p = findProductById(idTrim);
    if (!p) {
        showDetailNotFound(idTrim);
        return;
    }

    applyProductDetailToDom(p);

    const apiP = await enrichProductFromApi(idTrim);
    if (apiP && String(apiP.id) === idTrim) {
        const ix = catalog.findIndex((i) => String(i.id) === idTrim);
        if (ix >= 0) catalog[ix] = { ...catalog[ix], ...apiP };
        else catalog.push(apiP);
        const merged = findProductById(idTrim);
        if (merged) applyProductDetailToDom(merged);
    }
}

function renderCart() {
    if (!isCartPage()) return;
    const box = qs('#cart-items-container');
    if (!box) return;
    if (!cart.length) {
        box.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--gray-color);">Your cart is empty. <a href="products.html" style="color: var(--primary-color);">Start shopping</a></div>';
        const { subtotal: s, discount: d, tax: t, total: tot } = computeCartTotals([]);
        if (qs('#cart-item-count')) qs('#cart-item-count').textContent = '0';
        if (qs('#summary-subtotal')) qs('#summary-subtotal').textContent = money(s);
        if (qs('#summary-discount')) qs('#summary-discount').textContent = `-${money(d)}`;
        if (qs('#summary-tax')) qs('#summary-tax').textContent = `+${money(t)}`;
        if (qs('#summary-total')) qs('#summary-total').textContent = money(tot);
        return;
    }

    box.innerHTML = cart.map((item) => {
        const safeName = item.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const safeImg = item.image.replace(/"/g, '');
        const safeId = String(item.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<div class="cart-item-row"><div class="cart-item-img"><img src="${safeImg}" alt="${safeName}" style="height:100%;object-fit:contain;"></div><div class="cart-item-details"><div style="display:flex;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:10px;"><h4 style="font-weight:600;">${item.name}</h4><div style="font-weight:600;">${money(item.price)}</div></div><div style="color: var(--gray-color); font-size: 14px; margin-bottom: 15px;">Ships worldwide · Brand warranty · Easy returns<br>Seller: Verified Brand Store</div><div style="display:flex;gap:10px;flex-wrap:wrap;"><button type="button" class="btn btn-white" style="color:#eb001b;padding:5px 15px;font-size:13px;" onclick="removeFromCart('${safeId}')">Remove</button><button type="button" class="btn btn-white" style="color: var(--primary-color); padding:5px 15px;font-size:13px;" onclick="saveCartItemForLater('${safeId}')">Save for later</button></div></div><div class="cart-item-qty"><select aria-label="Quantity" style="padding:5px 10px;border:1px solid var(--border-color);border-radius:4px;" onchange="updateQty('${safeId}', this.value)">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}" ${item.quantity === n ? 'selected' : ''}>Qty: ${n}</option>`).join('')}</select></div></div>`;
    }).join('');

    const { subtotal, discount, tax, total } = computeCartTotals(cart);
    if (qs('#cart-item-count')) qs('#cart-item-count').textContent = String(cart.reduce((s, i) => s + i.quantity, 0));
    if (qs('#summary-subtotal')) qs('#summary-subtotal').textContent = money(subtotal);
    if (qs('#summary-discount')) qs('#summary-discount').textContent = `-${money(discount)}`;
    if (qs('#summary-tax')) qs('#summary-tax').textContent = `+${money(tax)}`;
    if (qs('#summary-total')) qs('#summary-total').textContent = money(total);
}

function renderSavedLater() {
    const grid = qs('#saved-later-dynamic');
    if (!grid) return;

    if (!saved.length) {
        grid.innerHTML = '<p style="color:var(--gray-color);padding:24px;">No saved items yet. Explore <a href="products.html" style="color:var(--primary-color);">products</a>.</p>';
        return;
    }

    grid.innerHTML = `<div class="saved-later-grid" style="width:100%;">${saved.map((p) => `
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <div style="background: #eee; border-radius: 6px; padding: 20px; text-align: center;">
                <img src="${(p.image || '').replace(/"/g, '')}" alt="" style="height: 120px; margin: 0 auto; object-fit: contain;">
            </div>
            <div style="font-weight: 700; font-size: 18px;">${money(p.price)}</div>
            <p style="color: var(--gray-color); font-size: 14px;">${(p.name || '').replace(/</g, '')}</p>
            <button type="button" class="btn btn-outline saved-move-btn" data-product-id="${String(p.id).replace(/"/g, '')}" style="width: fit-content; color: var(--primary-color); padding: 8px 15px; font-size: 14px;"><i class="fas fa-shopping-cart"></i> Move to cart</button>
        </div>`).join('')}</div>`;

    qsa('.saved-move-btn').forEach((btn) => btn.addEventListener('click', () => {
        const pid = btn.dataset.productId;
        const product = catalog.find((i) => String(i.id) === String(pid));
        if (product) addToCart(product);
    }));
}

function initCart() {
    if (!isCartPage()) return;
    renderCart();
    renderSavedLater();
    if (qs('#coupon-apply')) qs('#coupon-apply').addEventListener('click', () => toast(qs('#coupon-input')?.value.trim() ? `Coupon "${qs('#coupon-input').value.trim()}" applied.` : 'Enter a coupon code first.'));
    if (qs('#checkout-button')) qs('#checkout-button').addEventListener('click', () => {
        if (!cart.length) {
            toast('Add products before checkout.');
            return;
        }
        window.location.href = 'checkout.html';
    });
}

async function initCheckout() {
    if (!isCheckoutPage()) return;
    const holder = qs('#checkout-order-lines');
    const form = qs('#checkout-form');

    cart = JSON.parse(localStorage.getItem('cart') || '[]');

    const fillSummary = () => {
        const { subtotal, discount, tax, total } = computeCartTotals(cart);
        if (qs('#co-sub')) qs('#co-sub').textContent = money(subtotal);
        if (qs('#co-disc')) qs('#co-disc').textContent = `-${money(discount)}`;
        if (qs('#co-tax')) qs('#co-tax').textContent = `+${money(tax)}`;
        if (qs('#co-ship')) qs('#co-ship').textContent = money(0);
        if (qs('#co-total')) qs('#co-total').textContent = money(total);
    };

    if (!cart.length) {
        if (holder) holder.innerHTML = '<p style="padding:24px;color:var(--gray-color);">Your cart is empty. <a href="products.html" style="color:var(--primary-color);">Browse products</a></p>';
        fillSummary();
        if (qs('#checkout-submit')) qs('#checkout-submit').disabled = true;
        return;
    }

    if (holder) {
        holder.innerHTML = cart.map((i) => `
            <div class="checkout-line">
                <img src="${String(i.image).replace(/"/g, '')}" alt="" width="48" height="48" style="object-fit:contain;border-radius:4px;">
                <div style="flex:1;">
                    <div style="font-weight:600;">${i.name.replace(/</g, '')}</div>
                    <div style="font-size:13px;color:var(--gray-color);">Qty ${i.quantity}</div>
                </div>
                <div style="font-weight:600;">${money(Number(i.price) * i.quantity)}</div>
            </div>`).join('');
    }
    fillSummary();

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!getStoredToken()) {
            toast('Please sign in to complete your order.');
            window.location.href = `login.html?redirect=${encodeURIComponent('checkout.html')}`;
            return;
        }

        const addr = qs('#ship-address').value.trim();
        const city = qs('#ship-city').value.trim();
        const postal = qs('#ship-postal').value.trim();
        const country = qs('#ship-country').value.trim();

        if (!addr || !city || !postal || !country) {
            toast('Please fill all shipping fields.');
            return;
        }

        const pay = qs('input[name="payment"]:checked');
        const paymentMethod = pay ? pay.value : 'Cash on Delivery';

        const t = computeCartTotals(cart);

        const orderPayload = {
            orderItems: cart.map((line) => ({
                name: line.name,
                qty: Number(line.quantity),
                image: line.image || '',
                price: Number(line.price),
                product: String(line.id),
            })),
            shippingAddress: {
                address: addr,
                city,
                postalCode: postal,
                country,
            },
            paymentMethod,
            itemsPrice: Math.max(0, t.subtotal - t.discount),
            taxPrice: t.tax,
            shippingPrice: 0,
            totalPrice: t.total,
        };

        qs('#checkout-submit').disabled = true;
        qs('#checkout-submit').textContent = 'Placing order…';

        const { ok, data } = await apiJson('/orders', 'POST', orderPayload);

        qs('#checkout-submit').disabled = false;
        qs('#checkout-submit').textContent = 'Place order';

        if (!ok || !data.success) {
            toast(typeof data.error === 'string' ? data.error : 'Checkout failed.');
            return;
        }

        const orderId = data.data?._id;
        toast('Thank you — your order is confirmed.');
        clearCart();
        if (orderId) window.location.href = `orders.html?id=${encodeURIComponent(orderId)}`;
        else window.location.href = 'orders.html';
    });
}

function initLoginRegister() {
    const isLogin = isLoginPage();
    const form = qs(isLogin ? '#login-form' : '#register-form');
    if (!form) return;

    const qsRedir = window.location.search || '';
    if (isLogin) {
        const reg = qs('#register-from-login');
        if (reg) reg.href = `register.html${qsRedir}`;
    } else {
        const loginL = qs('#login-from-register');
        if (loginL) loginL.href = `login.html${qsRedir}`;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = qs('input[type="email"]', form).value.trim();
        const password = qs('input[name="password"], input[type="password"]', form).value.trim();
        if (!email || !password) {
            toast('Email and password are required.');
            return;
        }

        let body = { email, password };
        if (!isLogin) {
            const name = qs('input[name="name"]', form)?.value.trim();
            body = { name, email, password };
            if (!name) {
                toast('Please enter your name.');
                return;
            }
        }

        qs('#auth-submit').disabled = true;

        const { ok, data } = await apiJson(isLogin ? '/auth/login' : '/auth/register', 'POST', body, false);

        qs('#auth-submit').disabled = false;

        if (!ok || !data.success) {
            toast(typeof data.error === 'string' ? data.error : 'Something went wrong.');
            return;
        }

        setAuth(data.token, data.user || { email, name });
        toast(isLogin ? 'Welcome back!' : 'Account created — you are signed in.');

        const redir = urlParam('redirect');
        window.location.href = redir ? decodeURIComponent(redir) : 'index.html';
    });
}

async function initOrders() {
    if (!isOrdersPage()) return;
    const box = qs('#orders-list-container');
    if (!box) return;

    const token = getStoredToken();
    if (!token) {
        box.innerHTML = '<p style="padding:40px;"><a href="login.html?redirect=' + encodeURIComponent('orders.html') + '" style="color:var(--primary-color);">Sign in</a> to see your orders.</p>';
        return;
    }

    const { ok, data } = await apiJson('/orders/myorders', 'GET');

    if (!ok || !data.success) {
        box.innerHTML = '<p style="padding:40px;color:var(--gray-color);">Could not load orders. Try signing in again.</p>';
        return;
    }

    const orders = data.data || [];

    if (!orders.length) {
        box.innerHTML = '<div class="card" style="padding:40px;text-align:center;"><p style="margin-bottom:16px;color:var(--gray-color);">No orders yet.</p><a href="products.html" class="btn btn-primary">Continue shopping</a></div>';
        return;
    }

    box.innerHTML = orders.slice().reverse().map((o) => {
        const oid = String(o._id).slice(-8).toUpperCase();
        const when = new Date(o.createdAt || Date.now()).toLocaleString();
        const lines = (o.orderItems || []).map((item) =>
            `<li style="display:flex;gap:12px;margin-bottom:8px;"><img src="${String(item.image).replace(/"/g, '')}" alt="" width="40" height="40" style="object-fit:contain;border-radius:4px;"><span>${Number(item.qty)}× ${item.name} — ${money(item.price)}</span></li>`).join('');
        const totalLine = `<div style="font-weight:700;margin-top:12px;font-size:18px;color:var(--primary-color);">${money(o.totalPrice || 0)}</div>`;

        const highlightId = urlParam('id');
        const hl = highlightId === String(o._id) ? ' ring-order-highlight' : '';

        return `<article class="card order-card${hl}" style="padding:20px;margin-bottom:16px;border:2px solid var(--border-color);">
            <header style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                <strong>Order #${oid}</strong>
                <span style="color:var(--gray-color);font-size:14px;">${when}</span>
            </header>
            <p style="font-size:14px;color:var(--gray-color);margin-bottom:8px;"><i class="fas fa-truck"></i> ${o.status || 'Processing'} · ${o.paymentMethod || ''}</p>
            <address style="font-style:normal;font-size:14px;margin-bottom:16px;line-height:1.5;">
                Ship to ${o.shippingAddress?.address || ''}, ${o.shippingAddress?.city || ''} ${o.shippingAddress?.postalCode || ''}, ${o.shippingAddress?.country || ''}
            </address>
            <ul style="list-style:none;padding:0;margin:0;">${lines}</ul>
            ${totalLine}
        </article>`;
    }).join('');
}

function initGeneral() {
    qsa('.newsletter-form').forEach((form) => form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = qs('input[type="email"]', form);
        if (!input?.value.trim()) return toast('Please enter your email.');
        form.reset();
        toast('Subscribed successfully.');
    }));
    qsa('.quote-form').forEach((form) => form.addEventListener('submit', (e) => {
        e.preventDefault();
        toast('Inquiry sent to suppliers.');
        form.reset();
    }));
    qsa('.promo-card, .service-item, .blue-banner .btn-orange').forEach((el) =>
        el.addEventListener('click', () => toast('Opening this section.')));
}

document.addEventListener('DOMContentLoaded', async () => {
    initProductNavigateDelegation();

    bootstrapCatalogSync();

    renderShell();
    initHeader();
    initSearch();
    updateCartIcons();
    initGeneral();

    if (isIndexPage()) {
        renderGrid('recommended-grid', [...catalog]);
    }

    initProducts();

    await initDetail();

    initCart();
    await initCheckout();
    initLoginRegister();
    await initOrders();

    hydrateCatalog()
        .then(() => {
            updateCartIcons();
            if (isIndexPage()) renderGrid('recommended-grid', [...catalog]);
            if (isProductsPage()) applyAllFilters();
            if (isProductDetailPage()) {
                const tid = (urlParamDecoded('id') || urlParam('id') || '').trim();
                const fresh = findProductById(tid);
                if (fresh) applyProductDetailToDom(fresh);
            }
        })
        .catch(() => {});
});

window.filterByCat = filterByCat;
window.filterByBrand = filterByBrand;
window.clearF = clearF;
window.removeFilterChip = removeFilterChip;
window.openDetail = openDetail;
window.addByProd = addByProd;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQty = updateQty;
window.clearCart = clearCart;
window.setView = setView;
window.togWl = togWl;
window.renderCart = renderCart;
window.saveProductForLater = saveProductForLater;
window.saveCartItemForLater = saveCartItemForLater;
window.computeCartTotals = computeCartTotals;
