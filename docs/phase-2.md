# Phase 2 - Authentication Foundation

## Implemented

- SQLAlchemy models for users, documents, leads, conversations, messages, activity events, and usage metrics.
- JWT authentication using access and refresh tokens.
- Signup, login, current-user, refresh, and protected-check APIs.
- Password hashing with Werkzeug `scrypt`.
- Backend validation for required fields, email normalization, and password strength.
- Frontend AuthContext with persisted JWT session state.
- Protected React routes for the authenticated workspace.
- Login and signup screens connected to the Flask API.

## Architecture Notes

User ownership is the core boundary for the SaaS. Documents, leads, conversations, and analytics records all carry a `user_id`, giving later phases a clean way to enforce tenant-scoped access.

The frontend keeps authentication state in one provider and injects the bearer token into the shared Axios client. Route protection lives in a layout-level guard, so feature pages remain focused on their own workflows.

## Next Phase

Phase 3 adds authenticated PDF upload APIs, file validation, multi-file upload handling, and the Upload UI.
