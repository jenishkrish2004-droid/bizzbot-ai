# BizzBot AI

BizzBot AI is a Retrieval-Augmented Generation lead generation SaaS platform. The current build includes the runnable project foundation, JWT authentication, PDF uploads, document indexing, RAG chat, AI lead extraction, and Phase 7 analytics.

## Phase 1 Runbook

1. Copy environment defaults:

   ```bash
   cp .env.example .env
   ```

2. Start the platform:

   ```bash
   docker compose up --build
   ```

3. Open the app:

   - Frontend: http://localhost:5173
   - Backend health: http://localhost:5000/api/health

## Architecture

- `backend/` contains the Flask application factory, configuration, database extension, service boundaries, AI pipeline modules, and future API routes.
- `frontend/` contains the React TypeScript app, route-level pages, reusable UI/layout primitives, and API client setup.
- `docker-compose.yml` coordinates PostgreSQL, Flask, and the production-built React frontend.

## Current Phase

Phase 7 adds analytics APIs, activity tracking, usage metrics, dashboard charts, and user-scoped reporting without changing the core project layout.

## Authentication API

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `GET /api/auth/protected-check`

## Document API

- `GET /api/documents`
- `POST /api/documents/upload`
- `POST /api/documents/:documentId/process`
- `GET /api/documents/:documentId`
- `DELETE /api/documents/:documentId`

## Chat API

- `GET /api/chat/conversations`
- `POST /api/chat/conversations`
- `GET /api/chat/conversations/:conversationId`
- `POST /api/chat/ask`

## Lead API

- `POST /api/leads/extract`
- `GET /api/leads`
- `GET /api/leads/:leadId`
- `DELETE /api/leads/:leadId`
- `GET /api/leads/export/csv`

## Analytics API

- `GET /api/analytics/overview`
- `GET /api/analytics/activity`
- `GET /api/analytics/usage`
