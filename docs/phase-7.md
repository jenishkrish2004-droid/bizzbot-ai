# Phase 7 - Analytics System

## Implemented

- JWT-protected analytics APIs under `/api/analytics`.
- Analytics service layer using the existing `ActivityEvent` and `UsageMetric` models.
- Workspace summary metrics for documents, leads, conversations, chat questions, and processing quality.
- Daily chart datasets for lead generation, processed documents, chat activity, and user engagement.
- Lead source distribution and document status distribution datasets.
- Recent activity feed backed by persisted analytics events.
- Best-effort activity and usage tracking in authentication, document, chat, and lead workflows.
- Frontend analytics API client and typed analytics payloads.
- Analytics dashboard with KPI cards, trend charts, distribution charts, success-rate indicators, and recent activity.

## API Endpoints

- `GET /api/analytics/overview?days=30` returns summary metrics, chart data, usage totals, and recent activity.
- `GET /api/analytics/activity?limit=20` returns recent activity events.
- `GET /api/analytics/usage?days=30` returns usage metric totals and daily metric trend rows.

All analytics routes require a valid access token and only return records scoped to the authenticated user.

## Tracked Events

- `user.signup`
- `user.login`
- `document.uploaded`
- `document.indexing_started`
- `document.indexed`
- `document.processing_failed`
- `document.deleted`
- `conversation.created`
- `chat.question_asked`
- `lead.extraction_completed`
- `lead.deleted`

## Usage Metrics

- `user_signups`
- `user_logins`
- `documents_uploaded`
- `documents_indexed`
- `documents_failed`
- `documents_deleted`
- `leads_extracted`
- `leads_deleted`
- `chat_questions_asked`
- `conversations_created`

## Architecture Notes

Analytics writes happen after the primary workflow commits. If analytics storage fails, the service logs the failure and rolls back only the analytics write so uploads, indexing, chat, and lead extraction remain usable.

The overview endpoint combines persisted events and usage metrics with the source-of-truth operational tables. This keeps the dashboard useful for existing workspaces that created documents, conversations, or leads before Phase 7 tracking was added.

## Next Phase

Phase 8 can improve visual polish, responsive refinements, and theme work without changing the analytics data contract.
