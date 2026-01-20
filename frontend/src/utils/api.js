/**
 * API Configuration utilities
 */

// API URL with /api suffix for making API calls
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Base URL without /api suffix for serving static assets (uploads, etc.)
export const API_BASE_URL = API_URL.replace(/\/api\/?$/, '');

// Helper to construct asset URLs
export const getAssetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};
