/**
 * UUID validation utilities.
 */

/**
 * Regular expression for validating UUID v4 format.
 * Matches: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (case-insensitive)
 */
export const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID.
 *
 * @param value - The string to validate
 * @returns true if the string is a valid UUID format
 *
 * @example
 * isValidUUID("550e8400-e29b-41d4-a716-446655440000") // true
 * isValidUUID("not-a-uuid") // false
 * isValidUUID("group-slug") // false
 */
export function isValidUUID(value: string): boolean {
    return UUID_REGEX.test(value);
}
