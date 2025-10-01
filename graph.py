"""
Graph Database Operations for Cartify E-commerce Platform
========================================================

This module handles all Neo4j graph database operations including:
- Product search and filtering
- Graph-based recommendations
- Product relationship queries
- Category and brand aggregations

The graph database stores:
- Products with attributes (title, brand, price, rating, etc.)
- Categories and tags as separate nodes
- User behavior data (views, purchases, cart additions)
- Product relationships (similar_to, also_bought)
- Purchase patterns for recommendation algorithms

Key Features:
- Efficient Cypher queries for product search
- Graph traversal for recommendations
- Relationship-based similarity scoring
- Advanced filtering with multiple criteria
"""

import os
from typing import List, Dict, Any
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Neo4j database connection configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# Initialize Neo4j driver with connection pooling
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

def close_driver():
    """
    Close the Neo4j database driver connection
    
    This function should be called when the application shuts down
    to properly release database connections and prevent resource leaks.
    """
    driver.close()

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def _to_product_map(rec) -> Dict[str, Any]:
    """
    Helper function to extract product data from Neo4j query results
    
    Handles different result formats that can be returned from Cypher queries:
    - Direct product dictionaries
    - Neo4j node objects with properties
    - Mixed result formats
    
    Args:
        rec: Neo4j query result record
        
    Returns:
        Dict[str, Any]: Product data as dictionary
    """
    # Try to get product data directly from result
    p = rec.get("p") or rec.get("product")
    if isinstance(p, dict):
        return p
    
    # Fallback: extract from Neo4j node object
    node = rec.get("pnode") or rec.get("product")
    props = dict(node) if node else {}
    return props

# ============================================================================
# PRODUCT SEARCH FUNCTIONS
# ============================================================================

def search_products(q: str, limit: int = 18) -> List[Dict[str, Any]]:
    """
    Perform text search across product titles, brands, categories, and tags
    
    Uses a sophisticated scoring system that prioritizes:
    1. Direct matches in title, brand, or category (score: 0.9)
    2. Tag matches through relationships (score: 0.7)
    
    Results are ordered by relevance score, then by rating and review count.
    
    Args:
        q (str): Search query string
        limit (int): Maximum number of results to return
        
    Returns:
        List[Dict[str, Any]]: List of matching products with all attributes
    """
    cypher = """
    CALL () {
      WITH $q AS q
      MATCH (p:Product)
      WHERE toLower(p.title) CONTAINS toLower(q)
         OR toLower(p.brand) CONTAINS toLower(q)
         OR toLower(p.category) CONTAINS toLower(q)
      RETURN p, 0.9 AS score
      UNION
      WITH $q AS q
      MATCH (p:Product)-[:HAS_TAG]->(t:Tag)
      WHERE toLower(t.name) CONTAINS toLower(q)
      RETURN p, 0.7 AS score
    }
    RETURN p {
      .sku, .title, .brand, .category, .price, .rating, .reviews, .stock, .color, .weight_g, .description, .tags
    } AS p
    ORDER BY score DESC, p.rating DESC, p.reviews DESC
    LIMIT $limit
    """
    with driver.session() as sess:
        res = sess.run(cypher, q=q, limit=limit)
        return [r["p"] for r in res]

def product_by_sku(sku: str) -> Dict[str, Any] | None:
    """
    Retrieve a specific product by its SKU identifier
    
    Args:
        sku (str): Product SKU (Stock Keeping Unit) identifier
        
    Returns:
        Dict[str, Any] | None: Product data if found, None otherwise
    """
    cypher = """
    MATCH (p:Product {sku:$sku})
    RETURN p {
      .sku, .title, .brand, .category, .price, .rating, .reviews, .stock, .color, .weight_g, .description, .tags
    } AS p
    """
    with driver.session() as sess:
        rec = sess.run(cypher, sku=sku).single()
        return rec["p"] if rec else None

# ============================================================================
# RECOMMENDATION FUNCTIONS
# ============================================================================

def also_bought(sku: str, k: int = 12) -> List[Dict[str, Any]]:
    """
    Get products that are frequently bought together with the given product
    
    This function leverages purchase pattern data to find products that
    customers typically buy in combination. The ALSO_BOUGHT relationship
    is derived from actual purchase data and weighted by frequency.
    
    Args:
        sku (str): Product SKU to find "also bought" recommendations for
        k (int): Maximum number of recommendations to return
        
    Returns:
        List[Dict[str, Any]]: List of recommended products ordered by frequency
    """
    cypher = """
    MATCH (:Product {sku:$sku})- [r:ALSO_BOUGHT]->(other:Product)
    RETURN other {
      .sku, .title, .brand, .category, .price, .rating, .reviews, .stock, .color, .weight_g, .description, .tags
    } AS product, r.count AS weight
    ORDER BY weight DESC, product.reviews DESC
    LIMIT $k
    """
    with driver.session() as sess:
        return [r["product"] for r in sess.run(cypher, sku=sku, k=k)]

def similar_products(sku: str, k: int = 12) -> List[Dict[str, Any]]:
    """
    Find products similar to the given product using graph relationships
    
    Uses the SIMILAR_TO relationship to traverse the product similarity graph.
    The relationship can be direct (1 hop) or indirect (2 hops) to find
    products that are similar to similar products.
    
    Note: Variable length patterns (*1..2) must use literal values in Neo4j,
    so the hop count is fixed to keep the query efficient.
    
    Args:
        sku (str): Product SKU to find similar products for
        k (int): Maximum number of recommendations to return
        
    Returns:
        List[Dict[str, Any]]: List of similar products ordered by rating and reviews
    """
    cypher = """
    MATCH (p:Product {sku:$sku})-[:SIMILAR_TO*1..2]->(s:Product)
    WHERE p <> s
    WITH DISTINCT s
    RETURN s {
      .sku, .title, .brand, .category, .price, .rating, .reviews, .stock, .color, .weight_g, .description, .tags
    } AS product
    ORDER BY product.rating DESC, product.reviews DESC
    LIMIT $k
    """
    with driver.session() as sess:
        return [r["product"] for r in sess.run(cypher, sku=sku, k=k)]

# ============================================================================
# CATALOG MANAGEMENT FUNCTIONS
# ============================================================================

def get_featured_products(limit: int = 8) -> List[Dict[str, Any]]:
    """
    Get featured products based on high ratings and popularity
    
    Featured products are selected based on:
    - Minimum rating of 4.0 stars
    - Minimum of 50 reviews (indicating popularity)
    
    Results are ordered by rating (descending) and review count (descending)
    to showcase the best and most popular items.
    
    Args:
        limit (int): Maximum number of featured products to return
        
    Returns:
        List[Dict[str, Any]]: List of featured products
    """
    cypher = """
    MATCH (p:Product)
    WHERE p.rating >= 4.0 AND p.reviews >= 50
    RETURN p {
        .sku, .title, .brand, .category, .price, .rating, .reviews, .stock, .color, .weight_g, .description, .tags
    } AS p
    ORDER BY p.rating DESC, p.reviews DESC
    LIMIT $limit
    """
    with driver.session() as sess:
        return [r["p"] for r in sess.run(cypher, limit=limit)]

def get_categories_with_counts() -> List[Dict[str, Any]]:
    """
    Get all product categories with their product counts
    
    This function is essential for building dynamic category filters
    in the frontend. It shows how many products exist in each category,
    helping users understand the catalog structure.
    
    Returns:
        List[Dict[str, Any]]: List of categories with product counts,
                              ordered by count (descending) then name (ascending)
    """
    cypher = """
    MATCH (c:Category)
    OPTIONAL MATCH (p:Product)-[:IN_CATEGORY]->(c)
    RETURN c.name AS category, count(p) AS count
    ORDER BY count DESC, c.name ASC
    """
    with driver.session() as sess:
        return [{"category": r["category"], "count": r["count"]} for r in sess.run(cypher)]

def get_brands_with_counts() -> List[Dict[str, Any]]:
    """
    Get all product brands with their product counts
    
    Provides brand information for filtering and brand-specific browsing.
    Only includes brands that have products in the catalog.
    
    Returns:
        List[Dict[str, Any]]: List of brands with product counts,
                              ordered by count (descending) then name (ascending)
    """
    cypher = """
    MATCH (p:Product)
    WHERE p.brand IS NOT NULL
    RETURN p.brand AS brand, count(p) AS count
    ORDER BY count DESC, p.brand ASC
    """
    with driver.session() as sess:
        return [{"brand": r["brand"], "count": r["count"]} for r in sess.run(cypher)]

def get_price_range() -> Dict[str, float]:
    """
    Get the minimum and maximum prices from all products
    
    This function is crucial for building price range sliders in the frontend.
    It provides the bounds for price-based filtering functionality.
    
    Returns:
        Dict[str, float]: Dictionary with 'min' and 'max' price values.
                         Defaults to 0-1000 range if no products exist.
    """
    cypher = """
    MATCH (p:Product)
    RETURN min(p.price) AS min_price, max(p.price) AS max_price
    """
    with driver.session() as sess:
        result = sess.run(cypher).single()
        if result:
            return {"min": result["min_price"] or 0, "max": result["max_price"] or 1000}
        return {"min": 0, "max": 1000}

# ============================================================================
# ADVANCED SEARCH FUNCTIONS
# ============================================================================

def search_products_with_filters(
    q: str = "", 
    category: str = "", 
    brand: str = "", 
    min_price: float = 0, 
    max_price: float = 1000,
    min_rating: float = 0,
    limit: int = 18
) -> List[Dict[str, Any]]:
    """
    Advanced product search with multiple filtering criteria
    
    This function provides comprehensive search capabilities by combining:
    - Text search across titles, brands, categories, and tags
    - Category filtering
    - Brand filtering  
    - Price range filtering
    - Minimum rating filtering
    
    The query is built dynamically based on provided parameters to ensure
    optimal performance and flexibility.
    
    Args:
        q (str): Search query for text matching (optional)
        category (str): Category filter (optional)
        brand (str): Brand filter (optional)
        min_price (float): Minimum price filter (default: 0)
        max_price (float): Maximum price filter (default: 1000)
        min_rating (float): Minimum rating filter (default: 0)
        limit (int): Maximum number of results to return (default: 18)
        
    Returns:
        List[Dict[str, Any]]: Filtered list of products matching all criteria,
                             ordered by rating and review count
    """
    # Start with base query - WHERE 1=1 allows for easy AND concatenation
    cypher = """
    MATCH (p:Product)
    WHERE 1=1
    """
    params: Dict[str, Any] = {"limit": limit}
    
    # Add text search filter if query provided
    if q:
        cypher += """
        AND (
            toLower(p.title) CONTAINS toLower($q)
            OR toLower(p.brand) CONTAINS toLower($q)
            OR toLower(p.category) CONTAINS toLower($q)
            OR EXISTS {
                MATCH (p)-[:HAS_TAG]->(t:Tag)
                WHERE toLower(t.name) CONTAINS toLower($q)
            }
        )
        """
        params["q"] = q
    
    # Add category filter if specified
    if category:
        cypher += " AND p.category = $category"
        params["category"] = category
    
    # Add brand filter if specified
    if brand:
        cypher += " AND p.brand = $brand"
        params["brand"] = brand
    
    # Add price range filters (only if different from defaults)
    if min_price > 0:
        cypher += " AND p.price >= $min_price"
        params["min_price"] = min_price
    
    if max_price < 1000:
        cypher += " AND p.price <= $max_price"
        params["max_price"] = max_price
    
    # Add rating filter if specified
    if min_rating > 0:
        cypher += " AND p.rating >= $min_rating"
        params["min_rating"] = min_rating
    
    # Complete the query with return clause and ordering
    cypher += """
    RETURN p {
        .sku, .title, .brand, .category, .price, .rating, .reviews, .stock, .color, .weight_g, .description, .tags
    } AS p
    ORDER BY p.rating DESC, p.reviews DESC
    LIMIT $limit
    """
    
    # Execute the query with all parameters
    with driver.session() as sess:
        return [r["p"] for r in sess.run(cypher, **params)]
