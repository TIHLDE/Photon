# @tihlde/photon-sdk

TypeScript SDK for the TIHLDE Photon API.

## Installation

```bash
# Configure npm to use GitHub Package Registry for @tihlde packages
echo "@tihlde:registry=https://npm.pkg.github.com" >> .npmrc

# Install the SDK
pnpm add @tihlde/photon-sdk
```

## Usage

### Authentication

The SDK provides a typed Better Auth client for authentication:

```ts
import { createAuthClient } from "@tihlde/photon-sdk/auth";

const auth = createAuthClient({
  baseURL: "https://api.tihlde.org",
});

// Sign in with email OTP
await auth.signIn.emailOtp({
  email: "user@ntnu.no",
  otp: "123456",
});

// Get current session
const { data: session } = await auth.getSession();
if (session) {
  console.log(`Logged in as ${session.user.name}`);
}

// Sign out
await auth.signOut();
```

### Types

Import types for session data, permissions, and groups:

```ts
import type {
  User,
  Session,
  ExtendedSession,
  GroupMembership,
  Permission,
} from "@tihlde/photon-sdk/types";

function handleSession(session: ExtendedSession) {
  console.log(`User: ${session.user.name}`);
  console.log(`Permissions: ${session.permissions.join(", ")}`);
  console.log(`Groups: ${session.groups.map((g) => g.slug).join(", ")}`);
}
```

### API Client (Coming Soon)

The API client module is a placeholder for an OpenAPI-generated client. Once configured, it will provide typed methods for all API endpoints:

```ts
import { createApiClient } from "@tihlde/photon-sdk/api";

const api = createApiClient({
  baseUrl: "https://api.tihlde.org",
});

// Future usage (after OpenAPI generation is configured):
// const events = await api.events.list();
// const event = await api.events.get({ id: "123" });
```

## Module Exports

The SDK provides multiple entry points for tree-shaking:

- `@tihlde/photon-sdk` - All modules
- `@tihlde/photon-sdk/auth` - Authentication client
- `@tihlde/photon-sdk/types` - TypeScript types
- `@tihlde/photon-sdk/api` - API client (placeholder)

## Development

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm --filter @tihlde/photon-sdk build

# Type check
pnpm --filter @tihlde/photon-sdk typecheck
```

## Publishing

The SDK is automatically published to GitHub Package Registry when a version tag is pushed:

```bash
# Bump version and create tag
cd packages/sdk
npm version patch  # or minor, major
git push --follow-tags
```

## License

MIT
