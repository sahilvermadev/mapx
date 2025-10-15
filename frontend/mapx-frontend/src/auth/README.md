# Authentication Module

This module contains all authentication-related functionality for the application.

## Structure

```
auth/
├── index.ts                    # Module exports
├── AuthContext.tsx            # React context for auth state
├── components/                # Authentication UI components
│   ├── AuthErrorBoundary.tsx  # Error boundary for auth errors
│   ├── LoginModal.tsx         # Login modal component
│   └── UsernameSetupModal.tsx  # Username setup modal
├── services/                   # Authentication services
│   ├── authService.ts         # Core authentication service
│   └── username.ts            # Username management service
├── hooks/                      # Authentication hooks (future)
└── types/                      # Authentication types (future)
```

## Usage

### Import from the module
```typescript
import { 
  useAuth, 
  authService, 
  LoginModal, 
  AuthErrorBoundary 
} from '../auth';
```

### Core Services

#### `authService`
- Token management (access + refresh tokens)
- Automatic token refresh
- User authentication status
- Logout functionality

#### `usernameService`
- Username validation
- Username status checking
- Username setup

### Components

#### `AuthContext` & `useAuth`
- Global authentication state management
- OAuth callback handling
- Authentication status checking

#### `LoginModal`
- Google OAuth login interface
- Development login for testing

#### `UsernameSetupModal`
- Username setup for new users
- Username validation

#### `AuthErrorBoundary`
- Error boundary for authentication errors
- Graceful error handling

## Best Practices

1. **Always use the module exports** - Import from `../auth` instead of individual files
2. **Use authService for token operations** - Don't access localStorage directly
3. **Use useAuth hook for React components** - Don't use authService directly in components
4. **Handle authentication errors gracefully** - Use AuthErrorBoundary for error boundaries

## File Naming Conventions

- **Components**: PascalCase (e.g., `LoginModal.tsx`)
- **Services**: camelCase (e.g., `authService.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`)
- **Types**: camelCase (e.g., `authTypes.ts`)
- **Context**: PascalCase (e.g., `AuthContext.tsx`)
