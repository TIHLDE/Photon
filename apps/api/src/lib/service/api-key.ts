import { createHash, randomBytes } from "node:crypto";
import { managedApiKey as apiKeyTable } from "@photon/db/schema";
import { eq } from "drizzle-orm";
import type { AppContext } from "../ctx";
import { ValidationError } from "../errors";

// ============================================================================
// Permission Registry - Type-safe permission handling for API keys
// ============================================================================

/**
 * Canonical, hardcoded permission registry for API keys grouped by scope.
 * Keys are scopes (e.g. "events", "users"), values are action names.
 * Permissions follow the format: "scope:action" (e.g. "events:create")
 */
export const API_KEY_PERMISSION_REGISTRY = {
    // System permissions
    users: ["view"],
    // Email permissions
    email: ["send"],
} as const;

/**
 * Extra singleton permissions that don't follow the scope:action pattern.
 * Examples: "root" for full system access
 */
export const API_KEY_EXTRA_PERMISSIONS = ["root"] as const;

// Type utilities for type-safe permission handling
type Registry = typeof API_KEY_PERMISSION_REGISTRY;

type Join<K extends string, V extends readonly string[]> = `${K}:${V[number]}`;

type PermissionFromRegistry = {
    [K in keyof Registry]: Join<K & string, Registry[K]>;
}[keyof Registry];

type ExtraPermission = (typeof API_KEY_EXTRA_PERMISSIONS)[number];

/**
 * Union type of all valid API key permission names in the system.
 * Examples: "events:create", "users:view", "root", "email:send"
 */
export type ApiKeyPermission = PermissionFromRegistry | ExtraPermission;

/**
 * Flattens the permission registry into an array of permission strings.
 * Converts { events: ["create", "delete"] } into ["events:create", "events:delete"]
 */
function flattenPermissionRegistry(registry: Registry): string[] {
    const names: string[] = [];
    for (const scope of Object.keys(registry)) {
        const actions = registry[scope as keyof Registry] as readonly string[];
        for (const action of actions) {
            names.push(`${scope}:${action}`);
        }
    }
    return names;
}

/**
 * Array of all valid API key permissions in the system.
 */
export const API_KEY_PERMISSIONS: readonly ApiKeyPermission[] = Object.freeze([
    ...flattenPermissionRegistry(API_KEY_PERMISSION_REGISTRY),
    ...API_KEY_EXTRA_PERMISSIONS,
] as ApiKeyPermission[]);

/**
 * Set of all valid API key permission names for O(1) lookup.
 */
export const API_KEY_PERMISSIONS_SET = new Set<string>(
    API_KEY_PERMISSIONS as readonly string[],
);

/**
 * Type guard to check if a string is a valid API key permission.
 */
export function isApiKeyPermission(name: string): name is ApiKeyPermission {
    return API_KEY_PERMISSIONS_SET.has(name);
}

/**
 * Validates an array of permission strings and returns only valid ones.
 * Throws a ValidationError if any invalid permissions are found.
 */
export function validateApiKeyPermissions(
    permissions: string[],
): ApiKeyPermission[] {
    const invalid = permissions.filter((p) => !isApiKeyPermission(p));
    if (invalid.length > 0) {
        throw new ValidationError(
            `Invalid API key permissions: ${invalid.join(", ")}. Valid permissions are: ${Array.from(API_KEY_PERMISSIONS).join(", ")}`,
            { invalidPermissions: invalid },
        );
    }
    return permissions as ApiKeyPermission[];
}

// ============================================================================
// Crypto Utilities - Key generation, hashing, and prefix extraction
// ============================================================================

const API_KEY_PREFIX = "photon_";
const API_KEY_LENGTH = 32; // bytes (will be 43 chars in base64url)
const PREFIX_DISPLAY_LENGTH = 12; // "photon_abc12"

/**
 * Generates a new API key with the format: photon_<random_base64url>
 * @returns Full API key string (e.g., "photon_Xe7FGH...")
 */
function generateApiKey(): string {
    const randomBytesBuffer = randomBytes(API_KEY_LENGTH);
    const base64url = randomBytesBuffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    return `${API_KEY_PREFIX}${base64url}`;
}

/**
 * Hashes an API key using SHA-256.
 * @param key - The full API key to hash
 * @returns Hex-encoded hash
 */
function hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
}

/**
 * Extracts the display prefix from an API key.
 * @param key - The full API key
 * @returns First N characters for display (e.g., "photon_abc12")
 */
function extractPrefix(key: string): string {
    return key.slice(0, PREFIX_DISPLAY_LENGTH);
}

// ============================================================================
// Service Types
// ============================================================================

export interface ApiKey {
    id: string;
    name: string;
    description: string;
    keyPrefix: string;
    createdById: string | null;
    lastUsedAt: Date | null;
    permissions: ApiKeyPermission[];
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateApiKeyParams {
    name: string;
    description: string;
    permissions: string[];
    metadata?: Record<string, unknown>;
    createdById?: string;
}

export interface CreateApiKeyResult extends ApiKey {
    key: string; // Full key - only returned on creation
}

export interface UpdateApiKeyParams {
    name?: string;
    description?: string;
    permissions?: string[];
    metadata?: Record<string, unknown>;
}

export interface ValidateApiKeyResult {
    valid: boolean;
    apiKey?: ApiKey;
}

export interface ApiKeyService {
    create(params: CreateApiKeyParams): Promise<CreateApiKeyResult>;
    list(): Promise<ApiKey[]>;
    getById(id: string): Promise<ApiKey | null>;
    update(id: string, params: UpdateApiKeyParams): Promise<ApiKey>;
    regenerate(id: string): Promise<CreateApiKeyResult>;
    delete(id: string): Promise<void>;
    validate(key: string): Promise<ValidateApiKeyResult>;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Parses stored permissions from JSON string to array.
 */
function parsePermissions(permissionsJson: string): ApiKeyPermission[] {
    try {
        const parsed = JSON.parse(permissionsJson);
        if (!Array.isArray(parsed)) {
            throw new Error("Permissions must be an array");
        }
        return validateApiKeyPermissions(parsed);
    } catch (error) {
        throw new Error(
            `Failed to parse API key permissions: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Parses stored metadata from JSON string to object.
 */
function parseMetadata(
    metadataJson: string | null,
): Record<string, unknown> | null {
    if (!metadataJson) return null;
    try {
        return JSON.parse(metadataJson) as Record<string, unknown>;
    } catch (error) {
        throw new Error(
            `Failed to parse API key metadata: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Maps database row to ApiKey domain object.
 */
function mapToApiKey(row: typeof apiKeyTable.$inferSelect): ApiKey {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        keyPrefix: row.keyPrefix,
        createdById: row.createdById,
        lastUsedAt: row.lastUsedAt,
        permissions: parsePermissions(row.permissions),
        metadata: parseMetadata(row.metadata),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/**
 * Creates an API key service instance.
 */
export function createApiKeyService(ctx: AppContext): ApiKeyService {
    const { db } = ctx;

    return {
        /**
         * Creates a new API key.
         * Returns the full key ONCE - it cannot be retrieved again.
         */
        async create(params: CreateApiKeyParams): Promise<CreateApiKeyResult> {
            // Validate permissions
            const validatedPermissions = validateApiKeyPermissions(
                params.permissions,
            );

            // Generate key and hash
            const key = generateApiKey();
            const keyHash = hashApiKey(key);
            const keyPrefix = extractPrefix(key);

            // Insert into database
            const [inserted] = await db
                .insert(apiKeyTable)
                .values({
                    name: params.name,
                    description: params.description,
                    keyHash,
                    keyPrefix,
                    createdById: params.createdById ?? null,
                    permissions: JSON.stringify(validatedPermissions),
                    metadata: params.metadata
                        ? JSON.stringify(params.metadata)
                        : null,
                })
                .returning();

            if (!inserted) {
                throw new Error("Failed to create API key");
            }

            return {
                ...mapToApiKey(inserted),
                key, // Full key - only returned here
            };
        },

        /**
         * Lists all API keys (without the full key).
         */
        async list(): Promise<ApiKey[]> {
            const rows = await db.select().from(apiKeyTable);
            return rows.map(mapToApiKey);
        },

        /**
         * Gets a single API key by ID (without the full key).
         */
        async getById(id: string): Promise<ApiKey | null> {
            const [row] = await db
                .select()
                .from(apiKeyTable)
                .where(eq(apiKeyTable.id, id))
                .limit(1);

            if (!row) return null;
            return mapToApiKey(row);
        },

        /**
         * Updates an API key's metadata.
         * Cannot update the key itself (use regenerate for that).
         */
        async update(id: string, params: UpdateApiKeyParams): Promise<ApiKey> {
            const updates: Partial<typeof apiKeyTable.$inferInsert> = {};

            if (params.name !== undefined) updates.name = params.name;
            if (params.description !== undefined)
                updates.description = params.description;
            if (params.permissions !== undefined) {
                const validatedPermissions = validateApiKeyPermissions(
                    params.permissions,
                );
                updates.permissions = JSON.stringify(validatedPermissions);
            }
            if (params.metadata !== undefined) {
                updates.metadata = params.metadata
                    ? JSON.stringify(params.metadata)
                    : null;
            }

            const [updated] = await db
                .update(apiKeyTable)
                .set(updates)
                .where(eq(apiKeyTable.id, id))
                .returning();

            if (!updated) {
                throw new Error(`API key with id ${id} not found`);
            }

            return mapToApiKey(updated);
        },

        /**
         * Regenerates an API key's key value.
         * Returns the new full key ONCE - it cannot be retrieved again.
         */
        async regenerate(id: string): Promise<CreateApiKeyResult> {
            // Generate new key and hash
            const key = generateApiKey();
            const keyHash = hashApiKey(key);
            const keyPrefix = extractPrefix(key);

            // Update in database
            const [updated] = await db
                .update(apiKeyTable)
                .set({ keyHash, keyPrefix })
                .where(eq(apiKeyTable.id, id))
                .returning();

            if (!updated) {
                throw new Error(`API key with id ${id} not found`);
            }

            return {
                ...mapToApiKey(updated),
                key, // Full key - only returned here
            };
        },

        /**
         * Deletes an API key.
         */
        async delete(id: string): Promise<void> {
            await db.delete(apiKeyTable).where(eq(apiKeyTable.id, id));
        },

        /**
         * Validates an API key.
         * If valid, updates the lastUsedAt timestamp and returns the API key with permissions.
         * If invalid, returns { valid: false }.
         */
        async validate(key: string): Promise<ValidateApiKeyResult> {
            // Hash the provided key
            const keyHash = hashApiKey(key);

            // Look up by hash
            const [row] = await db
                .select()
                .from(apiKeyTable)
                .where(eq(apiKeyTable.keyHash, keyHash))
                .limit(1);

            if (!row) {
                return { valid: false };
            }

            // Update lastUsedAt
            const [updated] = await db
                .update(apiKeyTable)
                .set({ lastUsedAt: new Date() })
                .where(eq(apiKeyTable.id, row.id))
                .returning();

            if (!updated) {
                throw new Error("Failed to update lastUsedAt for API key");
            }

            return {
                valid: true,
                apiKey: mapToApiKey(updated),
            };
        },
    };
}
