const API = "/api";

const permissions = {
  client: ["Buy books", "Write ratings and comments", "Use discount codes", "Join the community chat"],
  seller: ["Add new books", "Manage their own listings", "Share books to community chat"],
  admin: ["Add and remove books", "Moderate comments", "Manage users and seller listings", "View order data"]
};

const state = {
  books: [],
  cart: JSON.parse(localStorage.getItem("bibliotheca_cart")) || [],   // cart stays local until checkout
  favorites: [],                                                       // loaded from server when logged in
  token: localStorage.getItem("bibliotheca_token") || null,
  user: null,                                                          // { id, username, fullName, email, role }
  role: "client",
  promoCode: "",
  activeGenre: "all",
  currentBookId: null,
  currentBook: null,
  currentStars: 0,
  messages: []
};

const eur = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" });
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// ─────────────────────────────────────────────────────────────────────────────
// COVER IMAGE FALLBACK  (delegated, runs once at load — safer than inline onerror)
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("error", (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-cover-fallback")) return;
  const color = img.dataset.fallbackColor || "#2c4a2c";
  const title = img.dataset.fallbackTitle || "";
  const block = document.createElement("div");
  block.className = img.classList.contains("detail-cov-img") ? "detail-cov" : img.classList.contains("book-cover-img") ? "book-cover" : "";
  block.style.background = color;
  block.textContent = title;
  img.replaceWith(block);
}, true); // capture phase — "error" doesn't bubble

// ─────────────────────────────────────────────────────────────────────────────
// API HELPER
// ─────────────────────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function saveCart() {
  localStorage.setItem("bibliotheca_cart", JSON.stringify(state.cart));
}

function saveToken() {
  if (state.token) localStorage.setItem("bibliotheca_token", state.token);
  else localStorage.removeItem("bibliotheca_token");
}

function currentUser() { return state.user; }
function displayUserName() { return state.user ? state.user.username : "Guest"; }

// ─────────────────────────────────────────────────────────────────────────────
// PAGE NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────
function showPage(page) {
  $$(".page").forEach((item) => item.classList.remove("active"));
  $(`#page-${page}`).classList.add("active");
  closePanels();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (page === "cart") renderCart();
  if (page === "checkout") renderCheckout();
  if (page === "favorites") loadFavorites();
  if (page === "community") loadMessages();
  if (page === "orders") loadOrders();
}

function closePanels() {
  $$('[data-genre-menu], [data-filter-panel]').forEach((item) => item.classList.remove("open"));
}

function toast(message) {
  const box = $("[data-toast]");
  box.textContent = message;
  box.classList.remove("show");
  void box.offsetWidth;
  box.classList.add("show");
}

function stars(n) {
  const full = Math.round(n || 0);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function isFavorite(id) {
  return state.favorites.some((book) => book.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKS — load from API with current filters
// ─────────────────────────────────────────────────────────────────────────────
async function loadBooks() {
  const query = $("[data-search]").value.trim();
  const min = $("[data-price-min]").value;
  const max = $("[data-price-max]").value;
  const year = $("[data-year-filter]").value;
  const sort = $("[data-sort]").value;

  const params = new URLSearchParams();
  if (state.activeGenre !== "all") params.set("genre", state.activeGenre);
  if (query) params.set("search", query);
  if (min) params.set("minPrice", min);
  if (max) params.set("maxPrice", max);
  if (year && year !== "all") params.set("year", year);
  if (sort) params.set("sort", sort);

  try {
    state.books = await api(`/books?${params.toString()}`);
  } catch (err) {
    state.books = [];
    toast(err.message);
  }
  renderBooks();
}

async function loadGenres() {
  try {
    const genres = await api("/genres");
    $("[data-genre-menu]").innerHTML = `
      <strong style="color:var(--brown);font-size:.85rem;letter-spacing:.08em;text-transform:uppercase">All genres</strong>
      <div class="genre-dd-grid">
        <button class="gpill" type="button" data-genre="all">All</button>
        ${genres.map((g) => `<button class="gpill" type="button" data-genre="${g.name}">${g.name}</button>`).join("")}
      </div>`;
  } catch { /* ignore */ }
}

function coverHtml(book) {
  if (book.coverUrl) {
    return `<img class="book-cover book-cover-img" src="${escapeAttr(book.coverUrl)}" alt="${escapeAttr(book.title)} cover"
              loading="lazy" data-cover-fallback data-fallback-color="${escapeAttr(book.color)}" data-fallback-title="${escapeAttr(book.title)}" />`;
  }
  return `<div class="book-cover" style="background:${book.color}">${book.title}</div>`;
}

function escapeAttr(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function bookCard(book) {
  return `
    <article class="book-card" data-open-book="${book.id}">
      <button class="fav-heart" type="button" data-favorite="${book.id}" aria-label="Toggle favorite">${isFavorite(book.id) ? "♥" : "♡"}</button>
      <div class="book-cover-wrap">${coverHtml(book)}</div>
      <div class="book-info">
        <div class="book-name">${book.title}</div>
        <div class="book-author">${book.author}</div>
        <div class="book-row"><span class="stars-sm">${stars(book.rating)}</span><span class="book-price">${eur.format(book.price)}</span></div>
        <div class="card-actions">
          <button class="small-btn" type="button" data-add-cart="${book.id}">Add to cart</button>
          <button class="small-btn" type="button" data-share-book="${book.id}">Send to chat</button>
          ${state.role === "admin" ? `<button class="small-btn" type="button" data-remove-book="${book.id}">Remove</button>` : ""}
        </div>
      </div>
    </article>`;
}

function renderBooks() {
  const grid = $("[data-books-grid]");
  if (!grid) return;
  grid.innerHTML = state.books.length ? state.books.map(bookCard).join("") : `<div class="empty-state">No books found.</div>`;
}

function detailCoverHtml(book) {
  if (book.coverUrl) {
    return `<img class="detail-cov detail-cov-img" src="${escapeAttr(book.coverUrl)}" alt="${escapeAttr(book.title)} cover"
              data-cover-fallback data-fallback-color="${escapeAttr(book.color)}" data-fallback-title="${escapeAttr(book.title)}" />`;
  }
  return `<div class="detail-cov" style="background:${book.color}">${book.title}</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOK DETAIL
// ─────────────────────────────────────────────────────────────────────────────
async function openBook(id) {
  let book;
  try {
    book = await api(`/books/${id}`);
  } catch (err) {
    toast(err.message);
    return;
  }
  state.currentBookId = id;
  state.currentBook = book;
  state.currentStars = 0;

  $("[data-detail-content]").innerHTML = `
    <div class="detail-layout">
      ${detailCoverHtml(book)}
      <div class="detail-info">
        <h1>${book.title}</h1>
        <div class="detail-author">${book.author}</div>
        <div class="stars">${stars(book.rating)} <span class="muted">(${book.reviewCount} review${book.reviewCount === 1 ? "" : "s"})</span></div>
        <div class="detail-price">${eur.format(book.price)}</div>
        <div class="tags">${book.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
        <p>${book.description}</p>
        <div class="card-actions">
          <button class="co-btn" type="button" data-add-cart="${book.id}">Add to cart</button>
          <button class="small-btn" type="button" data-favorite="${book.id}">${isFavorite(book.id) ? "Remove favorite" : "Add favorite"}</button>
          <button class="small-btn" type="button" data-share-book="${book.id}">Send to chat</button>
        </div>
      </div>
    </div>
    <section class="rate-sec">
      <strong>Leave a rating and comment</strong>
      <div class="star-row">${[1, 2, 3, 4, 5].map((n) => `<button class="sbt" type="button" data-star="${n}">★</button>`).join("")}</div>
      <textarea data-comment-text placeholder="Write your opinion..."></textarea>
      <button class="co-btn" type="button" data-submit-comment>Submit</button>
      <div data-comment-list></div>
    </section>`;
  renderStarInput();
  await loadCommentList(id);
  showPage("detail");
}

function renderStarInput() {
  $$('[data-star]').forEach((button) => button.classList.toggle("lit", Number(button.dataset.star) <= state.currentStars));
}

async function loadCommentList(bookId) {
  const list = $("[data-comment-list]");
  if (!list) return;
  let reviews = [];
  try { reviews = await api(`/books/${bookId}/reviews`); } catch { /* ignore */ }
  list.innerHTML = reviews.length
    ? reviews.map((r) => `
        <div class="cmt-item">
          <div class="muted">${r.username}</div>
          <div class="stars-sm">${stars(r.rating)}</div>
          <p>${r.comment || ""}</p>
          ${state.role === "admin" ? `<button class="small-btn" type="button" data-remove-comment="${r.id}">Remove</button>` : ""}
        </div>`).join("")
    : `<p class="muted">No comments yet.</p>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CART  (kept client-side, prices re-validated server-side at checkout)
// ─────────────────────────────────────────────────────────────────────────────
function addToCart(id) {
  const book = state.books.find((b) => b.id === id) || state.currentBook;
  if (!book) return;
  const existing = state.cart.find((item) => item.bookId === id);
  if (existing) existing.quantity += 1;
  else state.cart.push({ bookId: id, quantity: 1, _snapshot: { title: book.title, author: book.author, price: book.price, color: book.color, coverUrl: book.coverUrl || null } });
  saveCart();
  updateBadge();
  toast(`${book.title} added to cart.`);
}

function cartEntries() {
  return state.cart.map((item) => ({ ...item, book: item._snapshot })).filter((item) => item.book);
}

function totals() {
  const subtotal = cartEntries().reduce((sum, item) => sum + item.book.price * item.quantity, 0);
  const promoDiscount = state.promoCode.toUpperCase() === "BOOK10" ? subtotal * 0.1 : 0;
  const afterPromo = subtotal - promoDiscount;
  const thresholdDiscount = afterPromo > 50 ? afterPromo * 0.05 : 0;
  const shipping = subtotal === 0 || afterPromo > 40 ? 0 : 4.99;
  return { subtotal, promoDiscount, thresholdDiscount, shipping, total: Math.max(0, afterPromo - thresholdDiscount + shipping) };
}

function summaryHtml() {
  const t = totals();
  return [["Subtotal", t.subtotal], ["Promo discount", -t.promoDiscount], ["Over 50 EUR discount", -t.thresholdDiscount], ["Shipping", t.shipping], ["Total", t.total]]
    .map(([label, value], index, rows) => `<div class="summary-row ${index === rows.length - 1 ? "total" : ""}"><span>${label}</span><strong>${eur.format(value)}</strong></div>`).join("");
}

function updateBadge() {
  $("[data-cart-count]").textContent = state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

function renderCart() {
  const entries = cartEntries();
  $("[data-cart-items]").innerHTML = entries.length ? entries.map(({ book, quantity, bookId }) => `
    <article class="cart-item">
      <div class="ccov" style="${book.coverUrl ? "" : `background:${book.color}`}">${book.coverUrl ? `<img src="${escapeAttr(book.coverUrl)}" alt="${escapeAttr(book.title)}" data-cover-fallback data-fallback-color="${escapeAttr(book.color)}" data-fallback-title="" />` : book.title}</div>
      <div class="cinfo"><strong>${book.title}</strong><div class="cauth">${book.author}</div><div class="cqty"><button class="qb" data-qty="${bookId}:-1">-</button><span>${quantity}</span><button class="qb" data-qty="${bookId}:1">+</button></div></div>
      <strong>${eur.format(book.price * quantity)}</strong>
      <button class="crm" type="button" data-remove-cart="${bookId}">x</button>
    </article>`).join("") : `<div class="empty-state">Your cart is empty.</div>`;
  $("[data-cart-summary]").innerHTML = entries.length ? `<div class="cart-total-box">${summaryHtml()}<button class="co-btn" type="button" data-page-link="checkout">Checkout</button></div>` : "";
}

function renderCheckout() {
  $("[data-promo-code]").value = state.promoCode;
  $("[data-checkout-summary]").innerHTML = summaryHtml();
}

// ─────────────────────────────────────────────────────────────────────────────
// FAVORITES  (server-backed, requires login)
// ─────────────────────────────────────────────────────────────────────────────
async function loadFavorites() {
  if (!state.user) {
    state.favorites = [];
    $("[data-favorites-grid]").innerHTML = `<div class="empty-state">Sign in to save favorites.</div>`;
    return;
  }
  try {
    state.favorites = await api("/favorites");
  } catch (err) {
    state.favorites = [];
    toast(err.message);
  }
  $("[data-favorites-grid]").innerHTML = state.favorites.length ? state.favorites.map(bookCard).join("") : `<div class="empty-state">No favorites yet.</div>`;
}

async function toggleFavorite(id) {
  if (!state.user) { toast("Please sign in to use favorites."); return; }
  try {
    if (isFavorite(id)) {
      await api(`/favorites/${id}`, { method: "DELETE" });
      state.favorites = state.favorites.filter((b) => b.id !== id);
    } else {
      await api(`/favorites/${id}`, { method: "POST" });
      const book = state.books.find((b) => b.id === id) || state.currentBook;
      if (book) state.favorites.push(book);
    }
  } catch (err) {
    toast(err.message);
    return;
  }
  renderBooks();
  if ($("#page-favorites").classList.contains("active")) loadFavorites();
  if ($("#page-detail").classList.contains("active")) openBook(state.currentBookId);
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS HISTORY
// ─────────────────────────────────────────────────────────────────────────────
async function loadOrders() {
  const list = $("[data-orders-list]");
  if (!state.user) {
    list.innerHTML = `<div class="empty-state">Please sign in to view your orders.</div>`;
    return;
  }
  list.innerHTML = `<div class="empty-state">Loading…</div>`;
  try {
    const orders = await api("/orders");
    if (!orders.length) {
      list.innerHTML = `<div class="empty-state">You haven't placed any orders yet.</div>`;
      return;
    }
    list.innerHTML = orders.map(o => {
      const date = new Date(o.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
      const payment = o.payment_method.replace(/_/g, " ");
      return `
        <div class="order-card">
          <div class="order-card-head">
            <div>
              <span class="order-card-id">Order #${o.id}</span>
              <span class="order-card-date"> · ${date}</span>
            </div>
            <span class="order-status ${o.status}">${o.status}</span>
          </div>
          <div class="order-card-items">
            📍 ${o.city}, ${o.street} ${o.number}
          </div>
          <div class="order-card-foot">
            <span class="order-card-pay">💳 ${payment}</span>
            <span class="order-card-total">${eur.format(o.total)}</span>
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    list.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY CHAT  (server-backed)
// ─────────────────────────────────────────────────────────────────────────────
async function loadMessages() {
  try {
    state.messages = await api("/messages");
  } catch { state.messages = []; }
  renderChat();
}

function renderChat() {
  const box = $("[data-chat-box]");
  const myName = displayUserName();
  box.innerHTML = state.messages.map((msg) => {
    const mine = msg.username === myName;
    return `<div class="msg ${mine ? "mine" : ""}"><div class="mav">${(msg.username || "?").slice(0, 1).toUpperCase()}</div><div class="mbody"><div class="muser">${msg.username}</div><div>${msg.text}</div></div></div>`;
  }).join("");
  box.scrollTop = box.scrollHeight;
}

async function sendChat() {
  const input = $("[data-chat-input]");
  const text = input.value.trim();
  if (!text) return;
  if (!state.user) { toast("Please sign in to chat."); return; }
  try {
    await api("/messages", { method: "POST", body: JSON.stringify({ text }) });
    input.value = "";
    await loadMessages();
  } catch (err) {
    toast(err.message);
  }
}

async function shareBook(id) {
  if (!state.user) { toast("Please sign in to share to chat."); return; }
  const book = state.books.find((b) => b.id === id) || state.currentBook;
  if (!book) return;
  try {
    await api("/messages", { method: "POST", body: JSON.stringify({ text: `Book recommendation: ${book.title} by ${book.author}` }) });
    toast("Book sent to community chat.");
  } catch (err) {
    toast(err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
async function loadMe() {
  if (!state.token) { state.user = null; return; }
  try {
    state.user = await api("/auth/me");
  } catch {
    state.user = null;
    state.token = null;
    saveToken();
  }
  state.role = state.user ? state.user.role : "client";
}

function renderAuth() {
  const user = currentUser();
  const authTabs = $("[data-auth-tabs]");
  const signInForm = $("[data-signin-form]");
  const signUpForm = $("[data-signup-form]");
  const profilePanel = $("[data-profile-panel]");
  const profileButton = document.querySelector('[data-page-link="profile"]');

  authTabs.classList.toggle("hidden", Boolean(user));
  signInForm.classList.toggle("hidden", Boolean(user) || !signInForm.classList.contains("active-auth"));
  signUpForm.classList.toggle("hidden", Boolean(user) || !signUpForm.classList.contains("active-auth"));
  profilePanel.classList.toggle("hidden", !user);

  if (!signInForm.classList.contains("active-auth") && !signUpForm.classList.contains("active-auth")) {
    signInForm.classList.add("active-auth");
    signInForm.classList.toggle("hidden", Boolean(user));
  }

  if (profileButton) profileButton.textContent = user ? `Profile (${user.username})` : "Sign in";

  if (user) {
    $("[data-profile-avatar]").textContent = user.username.slice(0, 1).toUpperCase();
    $("[data-profile-name]").textContent = user.fullName;
    $("[data-profile-email]").textContent = user.email;
    $("[data-profile-role]").textContent = user.role;
  }

  $("[data-role-permissions]").innerHTML = permissions[state.role].map((item) => `<li>${item}</li>`).join("");
  $("[data-book-form]").style.display = user && state.role !== "client" ? "grid" : "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CLICK HANDLER
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("click", async (event) => {
  const page = event.target.closest("[data-page-link]")?.dataset.pageLink;
  const toggle = event.target.closest("[data-toggle]")?.dataset.toggle;
  const genre = event.target.closest("[data-genre]")?.dataset.genre;
  const open = event.target.closest("[data-open-book]")?.dataset.openBook;
  const favorite = event.target.closest("[data-favorite]")?.dataset.favorite;
  const add = event.target.closest("[data-add-cart]")?.dataset.addCart;
  const share = event.target.closest("[data-share-book]")?.dataset.shareBook;
  const removeBook = event.target.closest("[data-remove-book]")?.dataset.removeBook;
  const qty = event.target.closest("[data-qty]")?.dataset.qty;
  const removeCart = event.target.closest("[data-remove-cart]")?.dataset.removeCart;
  const star = event.target.closest("[data-star]")?.dataset.star;
  const removeComment = event.target.closest("[data-remove-comment]")?.dataset.removeComment;

  if (page) showPage(page);
  if (toggle === "genre-menu") {
    event.stopPropagation();
    $("[data-genre-menu]").classList.toggle("open");
    return;
  }
  if (toggle === "filter-panel") {
    event.stopPropagation();
    $("[data-filter-panel]").classList.toggle("open");
    return;
  }

  if (genre) {
    state.activeGenre = genre;
    $$('[data-genre]').forEach((button) => button.classList.toggle("active", button.dataset.genre === genre));
    closePanels();
    await loadBooks();
    showPage("home");
  }
  if (open && !event.target.closest("button")) openBook(Number(open));
  if (favorite) toggleFavorite(Number(favorite));
  if (add) addToCart(Number(add));
  if (share) shareBook(Number(share));

  if (removeBook && state.role === "admin") {
    try {
      await api(`/books/${removeBook}`, { method: "DELETE" });
      state.cart = state.cart.filter((item) => item.bookId !== Number(removeBook));
      saveCart();
      await loadBooks();
      toast("Book removed.");
    } catch (err) { toast(err.message); }
  }

  if (qty) {
    const [id, delta] = qty.split(":").map(Number);
    const item = state.cart.find((entry) => entry.bookId === id);
    if (item) item.quantity += delta;
    state.cart = state.cart.filter((entry) => entry.quantity > 0);
    saveCart();
    updateBadge();
    renderCart();
  }
  if (removeCart) {
    state.cart = state.cart.filter((item) => item.bookId !== Number(removeCart));
    saveCart();
    updateBadge();
    renderCart();
  }
  if (star) {
    state.currentStars = Number(star);
    renderStarInput();
  }

  if (event.target.closest("[data-submit-comment]")) {
    if (!state.user) { toast("Please sign in to leave a review."); return; }
    const text = $("[data-comment-text]").value.trim();
    if (!text && !state.currentStars) return;
    try {
      await api(`/books/${state.currentBookId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating: state.currentStars || 5, comment: text || null })
      });
      state.currentStars = 0;
      $("[data-comment-text]").value = "";
      renderStarInput();
      await loadCommentList(state.currentBookId);
      const refreshed = await api(`/books/${state.currentBookId}`);
      state.currentBook = refreshed;
      const starsEl = $("#page-detail .stars");
      if (starsEl) starsEl.innerHTML = `${stars(refreshed.rating)} <span class="muted">(${refreshed.reviewCount} review${refreshed.reviewCount === 1 ? "" : "s"})</span>`;
      toast("Review submitted.");
    } catch (err) { toast(err.message); }
  }

  if (removeComment && state.role === "admin") {
    try {
      await api(`/reviews/${removeComment}`, { method: "DELETE" });
      await loadCommentList(state.currentBookId);
      toast("Review removed.");
    } catch (err) { toast(err.message); }
  }
});

["input", "change"].forEach((eventName) => {
  ["[data-search]", "[data-price-min]", "[data-price-max]", "[data-year-filter]", "[data-sort]"].forEach((selector) => {
    $(selector).addEventListener(eventName, () => loadBooks());
  });
});

$("[data-apply-promo]").addEventListener("click", async () => {
  const code = $("[data-promo-code]").value.trim();
  if (code) {
    try {
      await api(`/promo/${code}`);
      toast("Promo code applied.");
    } catch (err) {
      toast(err.message);
    }
  }
  state.promoCode = code;
  renderCheckout();
});

$("[data-checkout-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;          // capture before any await
  if (!state.cart.length) {
    $("[data-order-message]").textContent = "Add at least one book before placing an order.";
    return;
  }
  const form = new FormData(formEl);
  const payload = {
    fullName: form.get("name"),
    email: form.get("email"),
    city: form.get("city"),
    street: form.get("street"),
    number: form.get("number"),
    paymentMethod: form.get("payment"),
    needsInvoice: form.get("invoice") === "on",
    promoCode: state.promoCode || null,
    items: state.cart.map((item) => ({ bookId: item.bookId, quantity: item.quantity }))
  };
  try {
    const result = await api("/orders", { method: "POST", body: JSON.stringify(payload) });
    state.cart = [];
    saveCart();
    updateBadge();
    formEl.reset();
    // Show success modal
    document.getElementById("order-modal-sub").textContent =
      `Order #${result.orderId} · Total ${eur.format(result.total)}`;
    document.getElementById("order-modal-email").textContent =
      `A confirmation will be sent to ${payload.email}`;
    document.getElementById("order-modal").classList.add("visible");
    await loadBooks();
  } catch (err) {
    $("[data-order-message]").textContent = err.message;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH FORM HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
$("[data-signin-form]").classList.add("active-auth");
$("[data-auth-tabs]").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-auth-tab]")?.dataset.authTab;
  if (!tab) return;
  $$('[data-auth-tab]').forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  $("[data-signin-form]").classList.toggle("active-auth", tab === "signin");
  $("[data-signup-form]").classList.toggle("active-auth", tab === "signup");
  $("[data-signin-form]").classList.toggle("hidden", tab !== "signin");
  $("[data-signup-form]").classList.toggle("hidden", tab !== "signup");
});

$("[data-signin-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;          // capture before any await
  const form = new FormData(formEl);
  try {
    const result = await api("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
    });
    state.token = result.token;
    state.user = result.user;
    state.role = result.user.role;
    saveToken();
    formEl.reset();
    $("[data-signin-message]").textContent = "";
    await renderAll();
    toast(`Welcome, ${result.user.username}.`);
  } catch (err) {
    $("[data-signin-message]").textContent = err.message;
  }
});

$("[data-signup-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;          // capture before any await
  const form = new FormData(formEl);
  try {
    const result = await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        username: form.get("username"),
        fullName: form.get("fullName"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role")
      })
    });
    state.token = result.token;
    state.user = result.user;
    state.role = result.user.role;
    saveToken();
    formEl.reset();
    $("[data-signup-message]").textContent = "";
    await renderAll();
    toast("Account created.");
  } catch (err) {
    $("[data-signup-message]").textContent = err.message;
  }
});

$("[data-signout]").addEventListener("click", async () => {
  state.token = null;
  state.user = null;
  state.role = "client";
  saveToken();
  await renderAll();
  toast("Signed out.");
});

$("[data-book-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formEl = event.currentTarget;          // capture before any await
  if (!currentUser() || state.role === "client") { toast("Please sign in as a seller or admin first."); return; }
  const form = new FormData(formEl);
  const palette = ["#2c4a2c", "#4a1a1a", "#1a2a4a", "#3a2a1a", "#2a1a3a", "#0a2840"];
  try {
    await api("/books", {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"),
        author: form.get("author"),
        description: form.get("description") || "A new seller listing.",
        pages: 200,
        year: Number(form.get("year")),
        price: Number(form.get("price")),
        stock: 1,
        genreId: await resolveGenreId(form.get("genre")),
        coverUrl: form.get("coverUrl") || null,
        coverColor: palette[Math.floor(Math.random() * palette.length)]
      })
    });
    formEl.reset();
    await loadBooks();
    toast("Book added.");
  } catch (err) {
    toast(err.message);
  }
});

// genre form field is free text — match it to an existing genre id, fallback to genre 1
async function resolveGenreId(genreName) {
  try {
    const genres = await api("/genres");
    const match = genres.find((g) => g.name.toLowerCase() === String(genreName).toLowerCase());
    return match ? match.id : genres[0]?.id || 1;
  } catch {
    return 1;
  }
}

$("[data-send-chat]").addEventListener("click", sendChat);
$("[data-chat-input]").addEventListener("keydown", (event) => { if (event.key === "Enter") sendChat(); });

// ─────────────────────────────────────────────────────────────────────────────
// ORDER SUCCESS MODAL
// ─────────────────────────────────────────────────────────────────────────────
function closeOrderModal() {
  document.getElementById("order-modal").classList.remove("visible");
  renderCheckout();
  showPage("home");
}
document.getElementById("order-modal-close").addEventListener("click", closeOrderModal);
document.getElementById("order-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeOrderModal();
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────
async function renderAll() {
  await loadMe();
  await loadGenres();
  await loadBooks();
  updateBadge();
  renderAuth();
}

renderAll();