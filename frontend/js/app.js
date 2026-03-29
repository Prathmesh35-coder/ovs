// ============================================
// Online Voting System - Shared JavaScript
// Common utility functions used across all pages
// ============================================

/**
 * Display a message (success or error) on the page.
 * Looks for an element with id="message".
 */
function showMessage(text, type) {
    const msgDiv = document.getElementById('message');
    if (!msgDiv) return;

    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    msgDiv.innerHTML = `<div class="alert ${alertClass}">${text}</div>`;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        msgDiv.innerHTML = '';
    }, 5000);
}

/**
 * Check if the user is logged in with the correct role.
 * Redirects to login page if not authenticated.
 * @param {string} expectedRole - 'admin', 'user', or 'candidate'
 */
async function checkSession(expectedRole) {
    try {
        const res = await fetch('/api/session');
        const data = await res.json();

        if (!data.loggedIn || data.role !== expectedRole) {
            window.location.href = '/login.html';
        }
    } catch (err) {
        window.location.href = '/login.html';
    }
}

/**
 * Logout the current user and redirect to home page.
 */
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
        // Ignore errors during logout
    }
    window.location.href = '/index.html';
}
