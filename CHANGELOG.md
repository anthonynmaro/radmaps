# Changelog

All notable changes to RadMaps are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### New Features
- Gelato product catalog API with real product UIDs and pricing
- Product selector with live map preview and manual pan/zoom framing
- Support page with FAQ and public order lookup (no login required)
- Return & refund policy page
- GitHub Agentic Workflows for automated code review, security scanning, testing, and more

### Improvements
- Checkout redesigned as two-step flow (product selection → shipping)
- Render worker supports per-product dimensions and user framing
- Shipping and delivery emails include tracking links and support info
- Confirmation email shows product details and account creation prompt for guests

### Infrastructure
- CI pipeline (lint, typecheck, test, build) on all PRs
- 8 agent workflows + self-maintenance system
- Central agent dispatcher and MCP configuration
