import { mutationOptions } from "@tanstack/react-query";
import { apiClient } from "#/api/api-client";

/**
 * Gives an account that has none a username/password login.
 *
 * Not Better Auth's own: `/change-password` wants the current password, which
 * a Feide-created account never had. The session is the proof of ownership
 * here, the same way the emailed token is in the reset flow.
 */
export const setPasswordMutation = mutationOptions({
    mutationFn: ({ newPassword }: { newPassword: string }) =>
        apiClient.post("/api/user/me/password", { json: { newPassword } }),
});
