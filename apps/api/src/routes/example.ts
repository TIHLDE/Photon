import { Hono } from "hono";
import { session } from "~/middleware/session";
import {
    requirePermissions,
    requireAnyPermission,
    withPermissionCheck,
} from "~/middleware/permission";
import { requireRoles, requireAnyRole } from "~/middleware/role";
import { requireAuth } from "~/middleware/auth";
import { userHasPermission } from "~/lib/rbac/permissions";

const router = new Hono();

router.use("*", session);

router.get("/health", (c) => {
    return c.json({ status: "ok" });
});

router.use("/api/*", requireAuth);

router.get("/api/users", requirePermissions("user.read"), (c) => {
    return c.json({ message: "List of users" });
});

router.post("/api/users", requirePermissions("user.write"), (c) => {
    return c.json({ message: "User created" });
});

router.delete("/api/users/:id", requirePermissions("user.delete"), (c) => {
    return c.json({ message: "User deleted" });
});

router.get(
    "/api/events",
    requireAnyPermission("event.read", "admin.full_access"),
    (c) => {
        return c.json({ message: "List of events" });
    },
);

router.post("/api/events", requirePermissions("event.write"), (c) => {
    return c.json({ message: "Event created" });
});

router.get("/api/admin/logs", requireRoles("Admin"), (c) => {
    return c.json({ message: "System logs" });
});

router.get("/api/moderation", requireAnyRole("Admin", "Moderator"), (c) => {
    return c.json({ message: "Moderation panel" });
});

router.post(
    "/api/events/:id/register",
    withPermissionCheck("event.manage_registrations"),
    (c) => {
        return c.json({ message: "User registered for event" });
    },
);

router.post(
    "/api/users/:id/assign-role",
    requirePermissions("user.manage_roles", "admin.manage_permissions"),
    (c) => {
        return c.json({ message: "Role assigned to user" });
    },
);

router.get("/api/profile/:userId", requireAuth, async (c) => {
    const user = c.get("user");
    const targetUserId = c.req.param("userId");

    if (!user) {
        return c.json({ error: "User not found" }, 401);
    }

    if (user.id === targetUserId) {
        return c.json({ message: "Own profile data" });
    }

    const canViewOthers = await userHasPermission(user.id, "user.read");

    if (!canViewOthers) {
        return c.json({ error: "Permission denied" }, 403);
    }

    return c.json({ message: "Other user's profile data" });
});

export default router;
