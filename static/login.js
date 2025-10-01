// Login functionality for Cartify
const API = location.origin;

// DOM elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// Utility functions
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  successMessage.style.display = 'none';
}

function showSuccess(message) {
  successMessage.textContent = message;
  successMessage.style.display = 'block';
  errorMessage.style.display = 'none';
}

function hideMessages() {
  errorMessage.style.display = 'none';
  successMessage.style.display = 'none';
}

function setLoading(isLoading) {
  if (isLoading) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<div class="loading"></div> Signing In...';
  } else {
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Sign In';
  }
}

// Check if user is already logged in
function checkAuthStatus() {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('user');
  
  if (token && user) {
    // User is already logged in, redirect to main page
    window.location.href = './index.html';
  }
}

// Login function
async function login(username, password) {
  try {
    setLoading(true);
    hideMessages();
    
    const response = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Login successful
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      showSuccess('Login successful! Redirecting...');
      
      // Redirect to main page after a short delay
      setTimeout(() => {
        window.location.href = './index.html';
      }, 1000);
    } else {
      // Login failed
      showError(data.detail || 'Login failed. Please check your credentials.');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('Network error. Please check your connection and try again.');
  } finally {
    setLoading(false);
  }
}

// Logout function (for use in main app)
function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  window.location.href = './login.html';
}

// Form submission handler
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  if (!username || !password) {
    showError('Please enter both username and password.');
    return;
  }
  
  await login(username, password);
});

// Auto-focus username field
document.addEventListener('DOMContentLoaded', () => {
  usernameInput.focus();
  checkAuthStatus();
});

// Handle Enter key in password field
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loginForm.dispatchEvent(new Event('submit'));
  }
});

// Make logout function globally available
window.logout = logout;
