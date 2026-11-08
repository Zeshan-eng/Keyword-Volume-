/**
 * Build-time configuration. This file must never contain secrets — provider
 * credentials live only on the backend.
 *
 * BACKEND_BASE_URL: use http://localhost:8787 for local development and the
 * HTTPS URL of the deployed backend for production builds.
 */
export const BACKEND_BASE_URL = 'http://localhost:8787';

// The backend may call two providers in sequence (Labs, then Google Ads Live at
// ~7s average), each with its own 20s timeout.
export const BACKEND_TIMEOUT_MS = 45_000;
