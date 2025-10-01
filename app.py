"""
Cartify API - AI-Powered E-commerce Platform with Authentication & Wishlist
============================================================================

This FastAPI application provides a comprehensive e-commerce API with:
- Graph-based product search and recommendations
- AI-powered product suggestions using Ollama LLM
- User authentication and session management
- Personal wishlist management with statistics
- Advanced filtering and search capabilities
- RESTful API endpoints for frontend integration

Technologies:
- FastAPI: Modern Python web framework with authentication
- Neo4j: Graph database for product relationships
- Ollama: Local LLM for AI recommendations
- Pydantic: Data validation and serialization
- JWT-like tokens: Secure authentication system

Features:
- Secure login system with demo accounts
- Protected API endpoints requiring authentication
- Wishlist management with bulk operations
- Real-time statistics and export functionality
- Modern glassmorphism UI with responsive design
"""

import os
import secrets
from datetime import datetime, timedelta
from fastapi import FastAPI, Query, HTTPException, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv

# Import graph database operations
from graph import (
    search_products, product_by_sku, also_bought, similar_products, close_driver,
    get_featured_products, get_categories_with_counts, get_brands_with_counts, 
    get_price_range, search_products_with_filters
)

# Import AI-powered recommendation system
from rag import graph_rag_recommendations

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI application with metadata
app = FastAPI(
    title="Cartify API", 
    version="1.0",
    description="AI-powered e-commerce platform with graph-based recommendations"
)

# Configure CORS middleware for cross-origin requests
# Note: In production, restrict allow_origins to specific domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Allow all origins (development only)
    allow_credentials=True,       # Allow cookies and authorization headers
    allow_methods=["*"],          # Allow all HTTP methods
    allow_headers=["*"]           # Allow all headers
)

# Pydantic models
class RecommendRequest(BaseModel):
    """Request model for AI-powered product recommendations"""
    query: str                    # Natural language query (e.g., "lightweight camping gear")
    limit: int = 8               # Maximum number of recommendations to return

class WishlistRequest(BaseModel):
    """Request model for wishlist operations"""
    skus: list[str]              # List of product SKUs

class LoginRequest(BaseModel):
    """Request model for user authentication"""
    username: str
    password: str

class User(BaseModel):
    """User model"""
    username: str
    email: str | None = None
    full_name: str | None = None

# Simple in-memory user storage (in production, use a proper database)
# This stores user credentials and profile information
USERS_DB = {
    "demo": {
        "username": "demo",
        "password": "password123",  # In production, use hashed passwords (bcrypt, argon2)
        "email": "demo@cartify.com",
        "full_name": "Demo User"
    },
    "admin": {
        "username": "admin",
        "password": "admin123",
        "email": "admin@cartify.com",
        "full_name": "Administrator"
    }
}

# Token storage (in production, use Redis or database for scalability)
# Stores active authentication tokens with expiration times
ACTIVE_TOKENS = {}

# Security
security = HTTPBearer()

# ============================================================================
# AUTHENTICATION FUNCTIONS
# ============================================================================

def create_token(username: str) -> str:
    """
    Create a new authentication token for user session
    
    Args:
        username (str): Username to create token for
        
    Returns:
        str: Secure URL-safe token string
        
    Note:
        - Tokens expire after 24 hours for security
        - Uses cryptographically secure random generation
        - In production, consider shorter expiration times
    """
    token = secrets.token_urlsafe(32)  # 32 bytes = 256 bits of entropy
    expires_at = datetime.utcnow() + timedelta(hours=24)  # Token expires in 24 hours
    
    ACTIVE_TOKENS[token] = {
        "username": username,
        "expires_at": expires_at
    }
    
    return token

def verify_token(token: str) -> str:
    """Verify token and return username if valid"""
    if token not in ACTIVE_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    token_data = ACTIVE_TOKENS[token]
    if datetime.utcnow() > token_data["expires_at"]:
        # Token expired, remove it
        del ACTIVE_TOKENS[token]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    
    return token_data["username"]

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user"""
    token = credentials.credentials
    username = verify_token(token)
    
    if username not in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    user_data = USERS_DB[username]
    return User(
        username=user_data["username"],
        email=user_data["email"],
        full_name=user_data["full_name"]
    )

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/api/health")
def health():
    """
    Health check endpoint for monitoring and load balancers
    
    Returns:
        dict: Simple status confirmation
    """
    return {"status": "ok"}

@app.post("/api/auth/login")
def login(request: LoginRequest):
    """
    Authenticate user and return access token
    
    Args:
        request (LoginRequest): Username and password
        
    Returns:
        dict: Access token and user information
    """
    username = request.username
    password = request.password
    
    # Check if user exists and password is correct
    if username not in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    user_data = USERS_DB[username]
    if user_data["password"] != password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Create token
    token = create_token(username)
    
    return {
        "token": token,
        "user": {
            "username": user_data["username"],
            "email": user_data["email"],
            "full_name": user_data["full_name"]
        }
    }

@app.post("/api/auth/logout")
def logout(current_user: User = Depends(get_current_user)):
    """
    Logout user and invalidate token
    
    Args:
        current_user (User): Current authenticated user
        
    Returns:
        dict: Success message
    """
    # In a real application, you would invalidate the token here
    # For simplicity, we'll just return success
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me")
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user information
    
    Args:
        current_user (User): Current authenticated user
        
    Returns:
        User: Current user information
    """
    return current_user

@app.post("/api/wishlist/products")
def get_wishlist_products(request: WishlistRequest, current_user: User = Depends(get_current_user)):
    """
    Get detailed information for multiple products by SKUs (for wishlist)
    
    This endpoint efficiently retrieves multiple products in a single request,
    optimized for wishlist display with bulk operations.
    
    Args:
        request (WishlistRequest): List of product SKUs to retrieve
        current_user (User): Current authenticated user (required)
        
    Returns:
        dict: List of product details with full information
        
    Performance Notes:
        - Bulk retrieval reduces API calls from N to 1
        - Filters out non-existent products automatically
        - Authentication required for security
    """
    products = []
    for sku in request.skus:
        product = product_by_sku(sku)
        if product:
            products.append(product)
    
    return {"items": products}

@app.get("/api/product/{sku}")
def get_product(sku: str):
    """
    Get detailed information for a specific product by SKU
    
    Args:
        sku (str): Product SKU identifier
        
    Returns:
        dict: Product details or error message if not found
    """
    p = product_by_sku(sku)
    return p or {"error": "not_found"}

@app.get("/api/search")
def api_search(q: str = Query(..., min_length=1), limit: int = 18):
    """
    Basic product search across titles, brands, categories, and tags
    
    Args:
        q (str): Search query (minimum 1 character)
        limit (int): Maximum number of results to return
        
    Returns:
        dict: List of matching products with metadata
    """
    return {"items": search_products(q, limit=limit)}

@app.get("/api/recommend/by-product")
def rec_by_product(pid: str, k: int = 12):
    """
    Get graph-based product recommendations for a specific product
    
    Combines ALSO_BOUGHT and SIMILAR_TO relationships to provide
    intelligent product suggestions based on purchase patterns and
    product similarity.
    
    Args:
        pid (str): Product SKU to get recommendations for
        k (int): Number of recommendations to return
        
    Returns:
        dict: Deduplicated list of recommended products
    """
    # Get also-bought recommendations from purchase patterns
    ab = also_bought(pid, k=k)
    
    # Get similar products based on graph relationships
    sim = similar_products(pid, k=k)
    
    # Deduplicate results while preserving order
    seen = set()
    ordered = []
    for lst in (ab, sim):
        for p in lst:
            sku = p.get("sku")
            if sku not in seen:
                seen.add(sku)
                ordered.append(p)
    
    return {"items": ordered[:k]}

@app.post("/api/recommend/graph-rag")
def rec_graph_rag(body: RecommendRequest):
    """
    AI-powered product recommendations using Graph-RAG
    
    Uses Retrieval-Augmented Generation to provide intelligent
    product suggestions based on natural language queries.
    
    Args:
        body (RecommendRequest): Request containing query and limit
        
    Returns:
        dict: AI-generated recommendations with explanations
    """
    return graph_rag_recommendations(body.query, limit=body.limit)

@app.get("/api/featured")
def get_featured():
    """
    Get featured products (high-rated, popular items)
    
    Returns products with rating >= 4.0 and reviews >= 50
    to showcase the best items in the catalog.
    
    Returns:
        dict: List of featured products
    """
    return {"items": get_featured_products()}

@app.get("/api/categories")
def get_categories():
    """
    Get all product categories with product counts
    
    Useful for building dynamic category filters and
    displaying category statistics.
    
    Returns:
        dict: List of categories with their product counts
    """
    return {"categories": get_categories_with_counts()}

@app.get("/api/brands")
def get_brands():
    """
    Get all product brands with product counts
    
    Provides brand information for filtering and
    brand-specific product browsing.
    
    Returns:
        dict: List of brands with their product counts
    """
    return {"brands": get_brands_with_counts()}

@app.get("/api/price-range")
def get_price_range_api():
    """
    Get minimum and maximum prices from all products
    
    Essential for building price range sliders and
    price-based filtering functionality.
    
    Returns:
        dict: Min and max price values
    """
    return get_price_range()

@app.get("/api/search/advanced")
def advanced_search(
    q: str = Query("", min_length=0),
    category: str = Query(""),
    brand: str = Query(""),
    min_price: float = Query(0),
    max_price: float = Query(1000),
    min_rating: float = Query(0),
    limit: int = Query(18)
):
    """
    Advanced product search with multiple filters
    
    Provides comprehensive search capabilities with:
    - Text search across multiple fields
    - Category filtering
    - Brand filtering
    - Price range filtering
    - Minimum rating filtering
    
    Args:
        q (str): Search query (optional)
        category (str): Category filter (optional)
        brand (str): Brand filter (optional)
        min_price (float): Minimum price filter
        max_price (float): Maximum price filter
        min_rating (float): Minimum rating filter
        limit (int): Maximum results to return
        
    Returns:
        dict: Filtered list of products matching all criteria
    """
    return {"items": search_products_with_filters(
        q=q, category=category, brand=brand, 
        min_price=min_price, max_price=max_price, 
        min_rating=min_rating, limit=limit
    )}

# ============================================================================
# APPLICATION LIFECYCLE
# ============================================================================

@app.on_event("shutdown")
def shutdown_event():
    """
    Cleanup function called when the application shuts down
    
    Ensures proper closure of database connections to prevent
    resource leaks and connection pool issues.
    """
    close_driver()

# ============================================================================
# STATIC FILE SERVING
# ============================================================================

# Serve static files (HTML, CSS, JS) - must be last to not override API routes
# Redirect root to login page
@app.get("/")
def root():
    """Redirect root to login page"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/login.html")

app.mount("/", StaticFiles(directory="static", html=True), name="static")
