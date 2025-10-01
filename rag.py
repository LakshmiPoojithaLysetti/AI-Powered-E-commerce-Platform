"""
Retrieval-Augmented Generation (RAG) for AI-Powered Product Recommendations
=========================================================================

This module implements an AI-powered recommendation system that combines:
- Graph-based product retrieval from Neo4j
- Large Language Model (LLM) analysis using Ollama
- Natural language understanding for product recommendations

The RAG approach works in two stages:
1. RETRIEVAL: Use graph search to find relevant product candidates
2. GENERATION: Use LLM to analyze candidates and provide intelligent recommendations

Key Features:
- Natural language query processing
- Context-aware product analysis
- Intelligent product ranking and explanation
- Graceful degradation when AI services are unavailable
"""

import os
from typing import List, Dict
import httpx
from dotenv import load_dotenv
from graph import search_products

# Load environment variables
load_dotenv()

# Ollama configuration - local LLM server settings
OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "llama3.1")

# System prompt that defines the AI's role and behavior
SYSTEM_PROMPT = """You are a retail shopping assistant that writes concise, helpful product advice.
When given a user query and a list of candidate products (title, brand, category, price, rating, description),
you should:
1) infer the user's intent (need, budget, constraints),
2) pick top 3 products,
3) explain briefly (2-4 bullets) why they fit, using concrete attributes.
Keep it under 120 words. Do not invent specs. If unsure, say so."""

# ============================================================================
# LLM COMMUNICATION FUNCTIONS
# ============================================================================

def ollama_chat(messages: List[Dict]) -> str:
    """
    Communicate with Ollama LLM API for AI-powered analysis
    
    Sends a conversation to the local Ollama server and retrieves the AI's response.
    Uses a low temperature (0.2) for more deterministic, focused responses.
    
    Args:
        messages (List[Dict]): Conversation history with role and content
        
    Returns:
        str: AI-generated response content
        
    Raises:
        httpx.HTTPError: If the API request fails
    """
    url = f"{OLLAMA_BASE}/v1/chat/completions"
    payload = {
        "model": CHAT_MODEL,      # LLM model to use (e.g., llama3.1)
        "messages": messages,     # Conversation history
        "temperature": 0.2,       # Low temperature for focused responses
        "stream": False           # Get complete response at once
    }
    
    # Make HTTP request with timeout
    with httpx.Client(timeout=60) as client:
        r = client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"].strip()

# ============================================================================
# RAG RECOMMENDATION SYSTEM
# ============================================================================

def graph_rag_recommendations(query: str, limit: int = 8) -> Dict:
    """
    Implement Retrieval-Augmented Generation for intelligent product recommendations
    
    This function combines graph-based product retrieval with AI analysis to provide
    context-aware product recommendations. The process involves:
    
    1. RETRIEVAL PHASE:
       - Use graph search to find relevant product candidates
       - Leverage Neo4j relationships and text search
    
    2. GENERATION PHASE:
       - Format product data for LLM analysis
       - Send to Ollama for intelligent ranking and explanation
       - Return both candidates and AI-generated insights
    
    Args:
        query (str): Natural language query (e.g., "lightweight camping gear")
        limit (int): Maximum number of product candidates to retrieve
        
    Returns:
        Dict: Contains 'candidates' (product list) and 'summary' (AI analysis)
    """
    # STEP 1: Graph-based retrieval
    # Use the existing search system to find relevant products
    candidates = search_products(query, limit=limit)

    # STEP 2: Prepare data for LLM analysis
    # Format product information in a structured way for the AI
    lines = []
    for c in candidates:
        lines.append(
            f"- [{c.get('sku')}] {c.get('title','')} | "
            f"{c.get('brand','')} | {c.get('category','')} | "
            f"${c.get('price','')} | {c.get('rating','')}★ | "
            f"{c.get('description','')}"
        )
    
    # Create the user message with query and formatted product data
    user_msg = f"User query: {query}\nCandidates:\n" + "\n".join(lines)

    # STEP 3: AI analysis and generation
    try:
        # Send to Ollama for intelligent analysis
        content = ollama_chat([
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg}
        ])
    except Exception:
        # Graceful degradation: if AI service is unavailable,
        # still return the graph-based candidates without AI analysis
        content = ""

    # Return both the retrieved candidates and AI-generated insights
    return {
        "candidates": candidates,  # Graph-based product matches
        "summary": content         # AI-generated recommendations and explanations
    }
