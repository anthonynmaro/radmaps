# Changelog

All notable changes to RadMaps are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### New Features
- Admin section at `/admin` for staff roles, premade catalog management, homepage ordering, and support lookup
- Database-backed `premade_maps` catalog with public `GET /api/premade` and `GET /api/premade/:slug` APIs
- Map-ID premade creation flow that copies source route/style/stats assets into draft catalog rows
- Gelato product catalog API with real product UIDs and pricing
- Product selector with live map preview and manual pan/zoom framing
- Support page with FAQ and public order lookup (no login required)
- Return & refund policy page
- GitHub Agentic Workflows for automated code review, security scanning, testing, and more

### Improvements
- `anthonynmaro@gmail.com` is configured as the protected local/production super-admin
- Premade checkout/customization now resolves only published database-backed catalog rows
- Admin/support search avoids raw PostgREST filter strings and deduplicates safe query results
- Public catalog fallback to static seed data is limited to missing or completely empty database tables
- ESLint 9 flat config added so `npm run lint` is usable again
- Checkout redesigned as two-step flow (product selection → shipping)
- Render worker supports per-product dimensions and user framing
- Shipping and delivery emails include tracking links and support info
- Confirmation email shows product details and account creation prompt for guests

### Infrastructure
- Supabase migration for `admin_users` and `premade_maps` with RLS enabled
- Additional unit coverage for RBAC, premade defaults, publish validation, and catalog fallback behavior
- CI pipeline (lint, typecheck, test, build) on all PRs
- 8 agent workflows + self-maintenance system
- Central agent dispatcher and MCP configuration
