// Auto-generated from @photon/auth — do not edit manually.
// Source of truth: packages/auth/src/index.ts (customSession plugin)
// Regenerate: bun run scripts/generate-session-types.ts

export type ExtendedSession = {
    session: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;

    };
    user: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;

    };

};
