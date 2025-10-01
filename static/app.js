const API = location.origin; // same origin as FastAPI

// Authentication helpers
function getAuthToken() {
  return localStorage.getItem('authToken');
}

function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

function isAuthenticated() {
  return getAuthToken() && getCurrentUser();
}

function redirectToLogin() {
  window.location.href = './login.html';
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  redirectToLogin();
}

// Check authentication on page load
function checkAuthentication() {
  if (!isAuthenticated()) {
    redirectToLogin();
    return false;
  }
  return true;
}

// --- helpers ---
const $ = (s) => document.querySelector(s);
const results = $('#results');
const summary = $('#summary');
const contextList = $('#contextList');
const q = $('#q');
const form = $('#searchForm');
const sortBy = $('#sortBy');
const categoryFilter = $('#categoryFilter');
const brandFilter = $('#brandFilter');
const priceMin = $('#priceMin');
const priceMax = $('#priceMax');
const priceMinValue = $('#priceMinValue');
const priceMaxValue = $('#priceMaxValue');
const ratingFilter = $('#ratingFilter');
const cardTpl = $('#cardTpl');
const userInfo = $('#userInfo');
const logoutBtn = $('#logoutBtn');
const wishlistCount = $('#wishlistCount');

// Wishlist functionality
let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');

const modal = $('#modal');
const modalBody = $('#modalBody');
$('#modalClose').addEventListener('click', () => modal.style.display = 'none');
modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

function mapIdToSku(item){
  // safety: if backend produced {id:"..."} instead of {sku:"..."}
  if (item && !item.sku && item.id) item.sku = item.id;
  return item;
}
function fmtPrice(v){
  if (typeof v === 'number') return `$${v.toFixed(2)}`;
  const n = Number(v); return isFinite(n) ? `$${n.toFixed(2)}` : String(v);
}
function sortItems(items, key){
  switch(key){
    case 'price_asc': return items.sort((a,b)=>(a.price??1e9)-(b.price??1e9));
    case 'price_desc': return items.sort((a,b)=>(b.price??-1)-(a.price??-1));
    case 'rating_desc': return items.sort((a,b)=>(b.rating??0)-(a.rating??0));
    case 'reviews_desc': return items.sort((a,b)=>(b.reviews??0)-(a.reviews??0));
    default: return items; // relevance as returned
  }
}
function filterItemsByCategory(items, cat){
  if (!cat) return items;
  return items.filter(p => (p.category||'').toLowerCase() === cat.toLowerCase());
}

// Load dynamic filters
async function loadFilters() {
  try {
    const headers = {
      'Authorization': `Bearer ${getAuthToken()}`
    };
    
    // Load categories
    const categoriesRes = await fetch(`${API}/api/categories`, {
      headers: headers
    });
    
    if (categoriesRes.status === 401) {
      logout();
      return;
    }
    
    const categoriesData = await categoriesRes.json();
    const categorySelect = categoryFilter;
    categorySelect.innerHTML = '<option value="">All Categories</option>';
    categoriesData.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.category;
      option.textContent = `${cat.category} (${cat.count})`;
      categorySelect.appendChild(option);
    });

    // Load brands
    const brandsRes = await fetch(`${API}/api/brands`, {
      headers: headers
    });
    
    if (brandsRes.status === 401) {
      logout();
      return;
    }
    
    const brandsData = await brandsRes.json();
    const brandSelect = brandFilter;
    brandSelect.innerHTML = '<option value="">All Brands</option>';
    brandsData.brands.forEach(brand => {
      const option = document.createElement('option');
      option.value = brand.brand;
      option.textContent = `${brand.brand} (${brand.count})`;
      brandSelect.appendChild(option);
    });

    // Load price range
    const priceRes = await fetch(`${API}/api/price-range`, {
      headers: headers
    });
    
    if (priceRes.status === 401) {
      logout();
      return;
    }
    
    const priceData = await priceRes.json();
    priceMin.min = Math.floor(priceData.min);
    priceMin.max = Math.ceil(priceData.max);
    priceMax.min = Math.floor(priceData.min);
    priceMax.max = Math.ceil(priceData.max);
    priceMin.value = Math.floor(priceData.min);
    priceMax.value = Math.ceil(priceData.max);
    priceMinValue.textContent = Math.floor(priceData.min);
    priceMaxValue.textContent = Math.ceil(priceData.max);
  } catch (error) {
    console.error('Error loading filters:', error);
  }
}


// Wishlist functions
function saveWishlist() {
  localStorage.setItem('wishlist', JSON.stringify(wishlist));
}

function toggleWishlist(sku) {
  const index = wishlist.indexOf(sku);
  if (index > -1) {
    wishlist.splice(index, 1);
  } else {
    wishlist.push(sku);
  }
  saveWishlist();
  updateWishlistButtons();
}

function updateWishlistButtons() {
  document.querySelectorAll('.btn-wishlist').forEach(btn => {
    const card = btn.closest('.card');
    const sku = card.querySelector('.sku').textContent;
    if (wishlist.includes(sku)) {
      btn.classList.add('active');
      btn.textContent = '💖';
    } else {
      btn.classList.remove('active');
      btn.textContent = '❤️';
    }
  });
  
  // Update wishlist counter
  if (wishlistCount) {
    wishlistCount.textContent = wishlist.length;
  }
}

// --- rendering ---
function renderBadge(text){
  const span = document.createElement('span');
  span.className = 'badge';
  span.textContent = text;
  return span;
}
function renderCard(p){
  const node = cardTpl.content.cloneNode(true);
  node.querySelector('.card-title').textContent = p.title || '(Untitled)';
  node.querySelector('.sku').textContent = p.sku || '';

  const metaBits = [
    p.brand ? p.brand : null,
    p.category ? p.category : null,
    (p.price!=null) ? fmtPrice(p.price) : null,
    (p.rating!=null) ? `${p.rating}★` : null,
    (p.reviews!=null) ? `${p.reviews} reviews` : null,
    (p.stock!=null) ? `Stock: ${p.stock}` : null,
    p.color ? p.color : null
  ].filter(Boolean);
  node.querySelector('.meta').textContent = metaBits.join(' • ');
  node.querySelector('.desc').textContent = p.description || '';

  const tagsWrap = node.querySelector('.badges');
  (p.tags || []).slice(0, 6).forEach(t => tagsWrap.appendChild(renderBadge(t)));

  // Update wishlist button state
  const wishlistBtn = node.querySelector('.btn-wishlist');
  if (wishlist.includes(p.sku)) {
    wishlistBtn.classList.add('active');
    wishlistBtn.textContent = '💖';
  }

  // actions
  node.querySelector('.btn-similar').addEventListener('click', () => fetchSimilar(p.sku));
  node.querySelector('.btn-details').addEventListener('click', () => showDetails(p.sku));
  node.querySelector('.btn-quick-view').addEventListener('click', () => showQuickView(p));
  wishlistBtn.addEventListener('click', () => toggleWishlist(p.sku));

  return node;
}

function renderResults(items){
  results.innerHTML = '';
  items.forEach(p => {
    const card = renderCard(p);
    results.appendChild(card);
  });
  updateWishlistButtons();
}

function renderContext(items){
  contextList.innerHTML = '';
  items.slice(0, 12).forEach(p => {
    const li = document.createElement('li');
    li.textContent = `[${p.sku}] ${p.title} — ${p.brand} • ${p.category} • ${fmtPrice(p.price)} • ${p.rating??''}★`;
    contextList.appendChild(li);
  });
}

function setSummary(text){
  if (text && text.trim().length){
    summary.textContent = text;
    summary.style.display = 'block';
  } else {
    summary.style.display = 'none';
    summary.textContent = '';
  }
}

function setLoading(isLoading) {
  const submitBtn = document.querySelector('.searchbar button');
  if (isLoading) {
    submitBtn.textContent = 'Searching...';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
  } else {
    submitBtn.textContent = 'Search';
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
  }
}

// --- network ---
async function apiSearch(query, limit=18){
  const headers = {
    'Authorization': `Bearer ${getAuthToken()}`
  };
  const r = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
    headers: headers
  });
  
  if (r.status === 401) {
    logout();
    return [];
  }
  
  const data = await r.json();
  return (data.items || []).map(mapIdToSku);
}

async function fetchSimilar(sku){
  try{
    setSummary('Fetching graph neighbors…');
    const headers = {
      'Authorization': `Bearer ${getAuthToken()}`
    };
    const r = await fetch(`${API}/api/recommend/by-product?pid=${encodeURIComponent(sku)}&k=12`, {
      headers: headers
    });
    
    if (r.status === 401) {
      logout();
      return;
    }
    
    const data = await r.json();
    const items = (data.items || []).map(mapIdToSku);

    const cat = categoryFilter.value;
    const sort = sortBy.value;
    const filtered = sortItems(filterItemsByCategory(items, cat), sort);

    renderResults(filtered);
    setSummary(`Similar & also-bought for ${sku}`);
    renderContext(items);
  }catch(e){
    console.error(e);
    setSummary('Could not fetch neighbors. Please try again.');
  }
}

async function showDetails(sku){
  try{
    const headers = {
      'Authorization': `Bearer ${getAuthToken()}`
    };
    const r = await fetch(`${API}/api/product/${encodeURIComponent(sku)}`, {
      headers: headers
    });
    
    if (r.status === 401) {
      logout();
      return;
    }
    
    const p = mapIdToSku(await r.json());
    modalBody.innerHTML = `
      <h2 style="margin:0 0 6px 0">${p.title || '(Untitled)'} <span class="pill">${p.sku || ''}</span></h2>
      <div style="color:#9fb0cc;margin-bottom:6px">${[p.brand,p.category].filter(Boolean).join(' • ')}</div>
      <div class="hline"></div>
      <div><strong>Price:</strong> ${fmtPrice(p.price ?? '—')}</div>
      <div><strong>Rating:</strong> ${p.rating ?? '—'} ★ (${p.reviews ?? 0} reviews)</div>
      <div><strong>Stock:</strong> ${p.stock ?? '—'}</div>
      <div><strong>Color:</strong> ${p.color ?? '—'}</div>
      <div style="margin-top:8px">${p.description || ''}</div>
      ${Array.isArray(p.tags)&&p.tags.length ? `
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          ${p.tags.slice(0,12).map(t=>`<span class="badge">${t}</span>`).join('')}
        </div>` : ''
      }
      <div style="margin-top:1rem; text-align:center;">
        <button onclick="toggleWishlist('${p.sku}')" class="btn-wishlist" style="font-size:1.2rem; padding:0.5rem 1rem;">
          ${wishlist.includes(p.sku) ? '💖 Remove from Wishlist' : '❤️ Add to Wishlist'}
        </button>
      </div>
    `;
    modal.style.display = 'grid';
  }catch(e){
    console.error(e);
  }
}

function showQuickView(product) {
  modal.style.display = 'grid';
  modalBody.innerHTML = `
    <div style="display:flex; gap:1rem; align-items:flex-start;">
      <div style="flex:1;">
        <h2 style="margin-top:0;">${product.title}</h2>
        <div style="font-size:1.2rem; color:#ff6b6b; font-weight:bold; margin:0.5rem 0;">
          ${fmtPrice(product.price)}
        </div>
        <div style="margin:1rem 0;">
          <span style="background:#4ecdc4; color:white; padding:0.25rem 0.5rem; border-radius:15px; font-size:0.9rem;">
            ${product.rating}★ (${product.reviews} reviews)
          </span>
        </div>
        <p style="margin:1rem 0; line-height:1.5;">${product.description || 'No description available.'}</p>
        <div style="margin:1rem 0;">
          <strong>Brand:</strong> ${product.brand || 'N/A'} • 
          <strong>Category:</strong> ${product.category || 'N/A'} • 
          <strong>Stock:</strong> ${product.stock || 'N/A'}
        </div>
        <div style="margin:1rem 0;">
          ${(product.tags || []).map(t => `<span class="badge">${t}</span>`).join(' ')}
        </div>
      </div>
    </div>
    <div style="margin-top:1.5rem; display:flex; gap:1rem; justify-content:center;">
      <button onclick="toggleWishlist('${product.sku}')" class="btn-wishlist" style="font-size:1.1rem; padding:0.75rem 1.5rem;">
        ${wishlist.includes(product.sku) ? '💖 In Wishlist' : '❤️ Add to Wishlist'}
      </button>
      <button onclick="fetchSimilar('${product.sku}')" class="btn-similar" style="font-size:1.1rem; padding:0.75rem 1.5rem;">
        Find Similar
      </button>
      <button onclick="showDetails('${product.sku}')" class="btn-details" style="font-size:1.1rem; padding:0.75rem 1.5rem;">
        Full Details
      </button>
    </div>
  `;
}

// Advanced search with filters
async function performAdvancedSearch() {
  const query = q.value.trim();
  const category = categoryFilter.value;
  const brand = brandFilter.value;
  const minPrice = parseFloat(priceMin.value);
  const maxPrice = parseFloat(priceMax.value);
  const minRating = parseFloat(ratingFilter.value);

  setLoading(true);
  setSummary('Searching…');
  
  try{
    // Use advanced search API if any filters are applied, otherwise use simple search
    let items;
    // Check if any filters are actually set (not default values)
    const hasFilters = category || brand || minPrice > 0 || (maxPrice > 0 && maxPrice < 200) || minRating > 0;
    
    if (hasFilters) {
      const params = new URLSearchParams({
        q: query || '',
        category: category || '',
        brand: brand || '',
        min_price: minPrice.toString(),
        max_price: maxPrice.toString(),
        min_rating: minRating.toString(),
        limit: '24'
      });
      
      const headers = {
        'Authorization': `Bearer ${getAuthToken()}`
      };
      const res = await fetch(`${API}/api/search/advanced?${params}`, {
        headers: headers
      });
      
      if (res.status === 401) {
        logout();
        return;
      }
      
      const data = await res.json();
      items = data.items || [];
    } else {
      items = await apiSearch(query, 24);
    }
    
    renderContext(items);
    
    // Apply client-side sorting
    const sort = sortBy.value;
    const filtered = sortItems(items, sort);

    renderResults(filtered);
    
    const filterParts = [];
    if (category) filterParts.push(category);
    if (brand) filterParts.push(brand);
    if (minPrice > 0) filterParts.push(`$${minPrice}+`);
    if (maxPrice < 200) filterParts.push(`$${maxPrice}-`);
    if (minRating > 0) filterParts.push(`${minRating}+★`);
    const filterText = filterParts.join(', ');
    setSummary(`Found ${items.length} items${query ? ` for "${query}"` : ''}${filterText ? ` (${filterText})` : ''}`);
  }catch(err){
    console.error(err);
    setSummary('Search failed. Please try again.');
  } finally {
    setLoading(false);
  }
}

// --- main flow ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = q.value.trim();
  if (!query) {
    // If no query, clear results and show message
    renderResults([]);
    setSummary('Enter a search term to find products.');
    return;
  }
  await performAdvancedSearch();
});

// Event listeners for all filters
sortBy.addEventListener('change', performAdvancedSearch);
categoryFilter.addEventListener('change', performAdvancedSearch);
brandFilter.addEventListener('change', performAdvancedSearch);
ratingFilter.addEventListener('change', performAdvancedSearch);

// Price range listeners
priceMin.addEventListener('input', (e) => {
  priceMinValue.textContent = e.target.value;
  performAdvancedSearch();
});

priceMax.addEventListener('input', (e) => {
  priceMaxValue.textContent = e.target.value;
  performAdvancedSearch();
});

// Initialize app
async function initializeApp() {
  // Check authentication first
  if (!checkAuthentication()) {
    return;
  }
  
  // Display user info in header
  const user = getCurrentUser();
  userInfo.textContent = `👤 ${user.full_name || user.username}`;
  
  // Add logout button event listener
  logoutBtn.addEventListener('click', logout);
  
  await loadFilters();
  
  // Display welcome message with user info
  setSummary(`Welcome back, ${user.full_name || user.username}! Search for products using the search bar above.`);
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', initializeApp);

// autofocus
document.addEventListener('DOMContentLoaded', () => {
  q.focus();
});
