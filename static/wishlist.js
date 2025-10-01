/**
 * Wishlist Management System for Cartify
 * ======================================
 * 
 * This module provides comprehensive wishlist functionality including:
 * - Authentication and session management
 * - Bulk product loading and display
 * - Statistics calculation and display
 * - Sorting and filtering options
 * - Export functionality
 * - Individual product management
 * 
 * Features:
 * - Two-column layout with sidebar controls
 * - Real-time statistics (total items, value, average rating)
 * - Multiple sorting options (price, rating, name, featured)
 * - Export wishlist as JSON file
 * - Bulk operations (clear all, sort)
 * - Individual product actions (view, similar, remove)
 * 
 * Dependencies:
 * - Authentication system (login.js)
 * - Main app styling (style.css)
 * - FastAPI backend with wishlist endpoints
 */

// API configuration
const API = location.origin;

// DOM elements
const userInfo = document.getElementById('userInfo');
const logoutBtn = document.getElementById('logoutBtn');
const wishlistStats = document.getElementById('wishlistStats');
const wishlistActions = document.getElementById('wishlistActions');
const loadingMessage = document.getElementById('loadingMessage');
const emptyWishlist = document.getElementById('emptyWishlist');
const wishlistGrid = document.getElementById('wishlistGrid');
const totalItems = document.getElementById('totalItems');
const totalValue = document.getElementById('totalValue');
const avgRating = document.getElementById('avgRating');
const clearAllBtn = document.getElementById('clearAllBtn');
const exportBtn = document.getElementById('exportBtn');
const sortBtn = document.getElementById('sortBtn');

// Modal elements
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

// State
let wishlistProducts = [];
let currentSort = 'default';

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Get the current authentication token from localStorage
 * @returns {string|null} The authentication token or null if not found
 */
function getAuthToken() {
  return localStorage.getItem('authToken');
}

/**
 * Get the current user information from localStorage
 * @returns {Object|null} User object with username, email, full_name or null
 */
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Check if the user is currently authenticated
 * @returns {boolean} True if user has valid token and user data
 */
function isAuthenticated() {
  return getAuthToken() && getCurrentUser();
}

/**
 * Redirect user to login page
 */
function redirectToLogin() {
  window.location.href = './login.html';
}

/**
 * Logout user by clearing stored data and redirecting to login
 */
function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  redirectToLogin();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format price value as currency string
 * @param {number|string} price - Price value to format
 * @returns {string} Formatted price string (e.g., "$49.99")
 */
function formatPrice(price) {
  if (typeof price === 'number') return `$${price.toFixed(2)}`;
  const n = Number(price);
  return isFinite(n) ? `$${n.toFixed(2)}` : String(price);
}

/**
 * Get wishlist from localStorage
 * @returns {Array<string>} Array of product SKUs in wishlist
 */
function getWishlist() {
  return JSON.parse(localStorage.getItem('wishlist') || '[]');
}

/**
 * Save wishlist to localStorage
 * @param {Array<string>} wishlist - Array of product SKUs to save
 */
function saveWishlist(wishlist) {
  localStorage.setItem('wishlist', JSON.stringify(wishlist));
}

// API functions
async function fetchProductDetails(sku) {
  try {
    const headers = {
      'Authorization': `Bearer ${getAuthToken()}`
    };
    const response = await fetch(`${API}/api/product/${encodeURIComponent(sku)}`, {
      headers: headers
    });
    
    if (response.status === 401) {
      logout();
      return null;
    }
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Error fetching product details:', error);
    return null;
  }
}

async function loadWishlistProducts() {
  const wishlist = getWishlist();
  
  if (wishlist.length === 0) {
    showEmptyWishlist();
    return;
  }
  
  loadingMessage.style.display = 'block';
  wishlistGrid.style.display = 'none';
  emptyWishlist.style.display = 'none';
  
  try {
    // Use bulk API to fetch all wishlist products at once
    const headers = {
      'Authorization': `Bearer ${getAuthToken()}`,
      'Content-Type': 'application/json'
    };
    
    const response = await fetch(`${API}/api/wishlist/products`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ skus: wishlist })
    });
    
    if (response.status === 401) {
      logout();
      return;
    }
    
    if (response.ok) {
      const data = await response.json();
      wishlistProducts = data.items || [];
      
      if (wishlistProducts.length === 0) {
        showEmptyWishlist();
        return;
      }
      
      // Move Ultralight Daypack 20L to the top by default
      wishlistProducts.sort((a, b) => {
        const aIsFeatured = (a.title || '').includes('Ultralight Daypack 20L');
        const bIsFeatured = (b.title || '').includes('Ultralight Daypack 20L');
        
        if (aIsFeatured && !bIsFeatured) return -1;
        if (!aIsFeatured && bIsFeatured) return 1;
        return 0;
      });
      
      updateStats();
      renderWishlist();
      showWishlistContent();
    } else {
      console.error('Error loading wishlist products');
      showEmptyWishlist();
    }
    
  } catch (error) {
    console.error('Error loading wishlist products:', error);
    showEmptyWishlist();
  } finally {
    loadingMessage.style.display = 'none';
  }
}

function updateStats() {
  const total = wishlistProducts.length;
  const totalPrice = wishlistProducts.reduce((sum, product) => sum + (product.price || 0), 0);
  const avgRate = wishlistProducts.reduce((sum, product) => sum + (product.rating || 0), 0) / total;
  
  totalItems.textContent = total;
  totalValue.textContent = formatPrice(totalPrice);
  avgRating.textContent = avgRate.toFixed(1);
}

function renderWishlist() {
  wishlistGrid.innerHTML = '';
  
  wishlistProducts.forEach(product => {
    const item = createWishlistItem(product);
    wishlistGrid.appendChild(item);
  });
}

function createWishlistItem(product) {
  const item = document.createElement('div');
  item.className = 'wishlist-item';
  
  const metaBits = [
    product.brand || null,
    product.category || null,
    product.rating ? `${product.rating}★` : null,
    product.reviews ? `${product.reviews} reviews` : null,
    product.stock ? `Stock: ${product.stock}` : null,
    product.color || null
  ].filter(Boolean);
  
  item.innerHTML = `
    <div class="wishlist-item-header">
      <div class="wishlist-item-title">${product.title || '(Untitled)'}</div>
      <div class="wishlist-item-meta">${metaBits.join(' • ')}</div>
      <div class="wishlist-item-price">${formatPrice(product.price)}</div>
    </div>
    <div class="wishlist-item-body">
      <div class="wishlist-item-description">${product.description || 'No description available.'}</div>
      <div class="wishlist-item-tags">
        ${(product.tags || []).slice(0, 6).map(tag => `<span class="badge">${tag}</span>`).join('')}
      </div>
      <div class="wishlist-item-actions">
        <button class="wishlist-item-btn primary" onclick="viewProduct('${product.sku}')">View Details</button>
        <button class="wishlist-item-btn secondary" onclick="findSimilar('${product.sku}')">Find Similar</button>
        <button class="wishlist-item-btn danger" onclick="removeFromWishlist('${product.sku}')">Remove</button>
      </div>
    </div>
  `;
  
  return item;
}

function showWishlistContent() {
  wishlistStats.style.display = 'flex';
  wishlistActions.style.display = 'flex';
  wishlistGrid.style.display = 'grid';
  emptyWishlist.style.display = 'none';
}

function showEmptyWishlist() {
  wishlistStats.style.display = 'none';
  wishlistActions.style.display = 'none';
  wishlistGrid.style.display = 'none';
  emptyWishlist.style.display = 'block';
}

// Action functions
function removeFromWishlist(sku) {
  const wishlist = getWishlist();
  const updatedWishlist = wishlist.filter(item => item !== sku);
  saveWishlist(updatedWishlist);
  
  // Remove from current display
  wishlistProducts = wishlistProducts.filter(product => product.sku !== sku);
  
  if (wishlistProducts.length === 0) {
    showEmptyWishlist();
  } else {
    updateStats();
    renderWishlist();
  }
}

function clearAllWishlist() {
  if (confirm('Are you sure you want to clear your entire wishlist?')) {
    saveWishlist([]);
    wishlistProducts = [];
    showEmptyWishlist();
  }
}

function exportWishlist() {
  if (wishlistProducts.length === 0) {
    alert('Your wishlist is empty!');
    return;
  }
  
  const exportData = wishlistProducts.map(product => ({
    title: product.title,
    brand: product.brand,
    category: product.category,
    price: product.price,
    rating: product.rating,
    sku: product.sku,
    description: product.description
  }));
  
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cartify-wishlist.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sortWishlist() {
  const sortOptions = ['default', 'price_asc', 'price_desc', 'rating_desc', 'name_asc', 'featured_first'];
  const currentIndex = sortOptions.indexOf(currentSort);
  const nextIndex = (currentIndex + 1) % sortOptions.length;
  currentSort = sortOptions[nextIndex];
  
  switch (currentSort) {
    case 'price_asc':
      wishlistProducts.sort((a, b) => (a.price || 0) - (b.price || 0));
      sortBtn.textContent = 'Sort by Price ↑';
      break;
    case 'price_desc':
      wishlistProducts.sort((a, b) => (b.price || 0) - (a.price || 0));
      sortBtn.textContent = 'Sort by Price ↓';
      break;
    case 'rating_desc':
      wishlistProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      sortBtn.textContent = 'Sort by Rating';
      break;
    case 'name_asc':
      wishlistProducts.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      sortBtn.textContent = 'Sort by Name';
      break;
    case 'featured_first':
      // Move Ultralight Daypack 20L to the top
      wishlistProducts.sort((a, b) => {
        const aIsFeatured = (a.title || '').includes('Ultralight Daypack 20L');
        const bIsFeatured = (b.title || '').includes('Ultralight Daypack 20L');
        
        if (aIsFeatured && !bIsFeatured) return -1;
        if (!aIsFeatured && bIsFeatured) return 1;
        return 0;
      });
      sortBtn.textContent = 'Featured First';
      break;
    default:
      // Keep original order (order added to wishlist)
      sortBtn.textContent = 'Sort by Date';
      break;
  }
  
  renderWishlist();
}

async function viewProduct(sku) {
  try {
    const product = await fetchProductDetails(sku);
    if (!product) {
      alert('Product not found!');
      return;
    }
    
    modalBody.innerHTML = `
      <h2 style="margin:0 0 6px 0">${product.title || '(Untitled)'} <span class="pill">${product.sku || ''}</span></h2>
      <div style="color:#9fb0cc;margin-bottom:6px">${[product.brand,product.category].filter(Boolean).join(' • ')}</div>
      <div class="hline"></div>
      <div><strong>Price:</strong> ${formatPrice(product.price ?? '—')}</div>
      <div><strong>Rating:</strong> ${product.rating ?? '—'} ★ (${product.reviews ?? 0} reviews)</div>
      <div><strong>Stock:</strong> ${product.stock ?? '—'}</div>
      <div><strong>Color:</strong> ${product.color ?? '—'}</div>
      <div style="margin-top:8px">${product.description || ''}</div>
      ${Array.isArray(product.tags)&&product.tags.length ? `
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          ${product.tags.slice(0,12).map(t=>`<span class="badge">${t}</span>`).join('')}
        </div>` : ''
      }
      <div style="margin-top:1rem; text-align:center;">
        <button onclick="removeFromWishlist('${product.sku}')" class="wishlist-item-btn danger" style="font-size:1.2rem; padding:0.5rem 1rem;">
          Remove from Wishlist
        </button>
      </div>
    `;
    modal.style.display = 'grid';
  } catch (error) {
    console.error('Error viewing product:', error);
    alert('Error loading product details!');
  }
}

async function findSimilar(sku) {
  try {
    const headers = {
      'Authorization': `Bearer ${getAuthToken()}`
    };
    const response = await fetch(`${API}/api/recommend/by-product?pid=${encodeURIComponent(sku)}&k=8`, {
      headers: headers
    });
    
    if (response.status === 401) {
      logout();
      return;
    }
    
    if (response.ok) {
      const data = await response.json();
      const similarProducts = data.items || [];
      
      if (similarProducts.length === 0) {
        alert('No similar products found!');
        return;
      }
      
      modalBody.innerHTML = `
        <h2 style="margin:0 0 1rem 0">Similar Products</h2>
        <div style="display: grid; gap: 1rem; max-height: 400px; overflow-y: auto;">
          ${similarProducts.map(product => `
            <div style="border: 1px solid #e1e5e9; border-radius: 8px; padding: 1rem;">
              <div style="font-weight: 600; margin-bottom: 0.5rem;">${product.title}</div>
              <div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">
                ${product.brand} • ${product.category} • ${formatPrice(product.price)}
              </div>
              <div style="color: #666; font-size: 0.85rem;">${product.description || 'No description'}</div>
            </div>
          `).join('')}
        </div>
      `;
      modal.style.display = 'grid';
    } else {
      alert('Error finding similar products!');
    }
  } catch (error) {
    console.error('Error finding similar products:', error);
    alert('Error finding similar products!');
  }
}

// Event listeners
modalClose.addEventListener('click', () => modal.style.display = 'none');
modal.addEventListener('click', (e) => { 
  if (e.target === modal) modal.style.display = 'none'; 
});

clearAllBtn.addEventListener('click', clearAllWishlist);
exportBtn.addEventListener('click', exportWishlist);
sortBtn.addEventListener('click', sortWishlist);
logoutBtn.addEventListener('click', logout);

// Initialize app
function initializeApp() {
  // Check authentication first
  if (!isAuthenticated()) {
    redirectToLogin();
    return;
  }
  
  // Display user info in header
  const user = getCurrentUser();
  userInfo.textContent = `👤 ${user.full_name || user.username}`;
  
  // Load wishlist
  loadWishlistProducts();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeApp);
