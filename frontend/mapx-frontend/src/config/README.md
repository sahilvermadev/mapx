# Configuration Directory

This directory contains centralized configuration files for the MAPX application.

## Files

- **`apiConfig.ts`** - API and backend URL configuration
- **`searchConfig.ts`** - Search functionality configuration
- **`designSystem.ts`** - **Design system tokens and utilities** (see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md))
- **`DESIGN_SYSTEM.md`** - Complete design system documentation

## Design System

All UI design tokens, colors, typography, spacing, shadows, and animations are centralized in `designSystem.ts`. This ensures consistent design language across all components and pages.

**Quick Start:**
```typescript
import designSystem from '@/config/designSystem';
// or import specific tokens
import { colors, spacing, shadows } from '@/config/designSystem';
```

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for complete documentation.

---

# API Configuration

## Overview

All backend URL references have been centralized in `apiConfig.ts` to make domain changes easy and maintainable.

## Usage

### Import the configuration functions:

```typescript
import { 
  getApiBaseUrl,      // For API requests
  getBackendBaseUrl,  // For OAuth redirects, profile pictures, etc.
  getApiUrl,          // Helper to construct full API URLs
  getBackendUrl,      // Helper to construct full backend URLs
  getProfilePictureUrl // Helper for profile picture URLs
} from '@/config/apiConfig';
```

### Examples

**API Requests:**
```typescript
const apiBase = getApiBaseUrl(); // Returns '/api' in prod, 'http://localhost:5000/api' in dev
const url = getApiUrl('/users'); // Returns '/api/users' in prod
```

**OAuth Redirects:**
```typescript
const backendBase = getBackendBaseUrl(); // Returns domain:5000 in prod, 'http://localhost:5000' in dev
const oauthUrl = getBackendUrl('/auth/google'); // Returns full OAuth URL
```

**Profile Pictures:**
```typescript
const profilePicUrl = getProfilePictureUrl(googleProfileUrl); // Automatically proxies Google URLs
```

## Environment Variables

To change the domain, update these environment variables:

- **VITE_API_BASE_URL**: Base URL for API requests
  - Default: `/api` (production) or `http://localhost:5000/api` (development)
  - In production, use relative URLs that are proxied by nginx

- **VITE_BACKEND_URL**: Base URL for backend (OAuth, profile pictures, etc.)
  - Default: `http://localhost:5000` (development)
  - In production, should be set to your domain (e.g., `https://rekky.ai`)

## Changing the Domain

1. Update environment variables in `.env` or Docker build args
2. Rebuild the frontend
3. No code changes needed!

## Architecture

- **API URLs**: Use relative paths (`/api`) in production, proxied by nginx to the backend
- **Backend URLs**: Use full URLs with domain for OAuth redirects and external resources
- **Profile Pictures**: Automatically handles Google profile picture proxying

