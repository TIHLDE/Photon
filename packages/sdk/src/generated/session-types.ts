// Auto-generated from @photon/auth — do not edit manually.
// Source of truth: packages/auth/src/index.ts (customSession plugin)
// Regenerate: bun run scripts/generate-session-types.ts

export type ExtendedSession = {
    user: {
        settings: {
            allergies: string[];
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            gender: "other" | "male" | "female";
            imageUrl: string | null;
            allowsPhotosByDefault: boolean;
            acceptsEventRules: boolean;
            bioDescription: string | null;
            githubUrl: string | null;
            linkedinUrl: string | null;
            receiveMailCommunication: boolean;
            isOnboarded: boolean;

        } | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;

    };
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
    permissions: string[];
    groups: {
        slug: string;
        name: string;
        type: string;
        role: string;

    }[];

};
