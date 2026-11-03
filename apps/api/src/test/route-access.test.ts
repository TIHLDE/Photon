import { describe, expect } from "vitest";
import { integrationTest } from "~/test/config/integration";

/**
 * Every route's access decision, so that adding one means making that decision
 * where a reviewer sees it. A new route fails the first test until it is listed
 * here; a merge that brings in another branch's routes may need their lines too.
 *
 * - `public`: anyone on the internet. This is the line to read closely.
 * - `api-key`: no session gets in, only the key.
 * - `signed-in`: a session or token, plus whatever the route checks against the
 *   resource itself. This includes group-scoped routes, whose permission check
 *   needs a group that exists.
 * - `permission`: a member with no grants is refused before the handler runs.
 */
type AccessDecision = "public" | "api-key" | "signed-in" | "permission";

const ROUTE_ACCESS: Record<string, AccessDecision> = {
    "DELETE /api/api-keys/:id": "permission",
    "DELETE /api/banners/:id": "permission",
    "DELETE /api/contracts/groups/:groupSlug/signatures/:userId": "permission",
    "DELETE /api/event/:eventId": "permission",
    "DELETE /api/event/:eventId/reactions": "signed-in",
    "DELETE /api/event/:eventId/registration": "signed-in",
    "DELETE /api/event/strikes/:strikeId": "permission",
    "DELETE /api/feedback/:id": "permission",
    "DELETE /api/feedback/:id/comments/:commentId": "permission",
    "DELETE /api/feedback/:id/vote": "signed-in",
    "DELETE /api/forms/:formId/submissions": "signed-in",
    "DELETE /api/forms/:formId/submissions/:id/destroy_with_reason":
        "signed-in",
    "DELETE /api/forms/:id": "signed-in",
    "DELETE /api/galleries/:slug": "permission",
    "DELETE /api/galleries/:slug/pictures/:pictureId": "permission",
    "DELETE /api/groups/:groupSlug/fines/:fineId": "signed-in",
    "DELETE /api/groups/:groupSlug/join": "signed-in",
    "DELETE /api/groups/:groupSlug/laws/:lawId": "signed-in",
    "DELETE /api/groups/:groupSlug/members/:userId": "permission",
    "DELETE /api/groups/:groupSlug/positions/:positionId": "signed-in",
    "DELETE /api/groups/:groupSlug/positions/:positionId/holders/:userId":
        "signed-in",
    "DELETE /api/groups/:slug": "permission",
    "DELETE /api/jobs/:id": "permission",
    "DELETE /api/news/:id": "permission",
    "DELETE /api/news/:id/reactions": "signed-in",
    "DELETE /api/notification/:id": "signed-in",
    "DELETE /api/notification/device": "signed-in",
    "DELETE /api/roles/:roleId": "permission",
    "DELETE /api/roles/:roleId/users/:userId": "permission",
    "DELETE /api/toddel/:edition": "permission",
    "DELETE /api/user/:id": "permission",
    "GET /.well-known/oauth-authorization-server/api/auth": "public",
    "GET /.well-known/openid-configuration": "public",
    "GET /api": "public",
    "GET /api/api-keys": "permission",
    "GET /api/api-keys/:id": "permission",
    "GET /api/applications": "permission",
    "GET /api/applications/:id": "signed-in",
    "GET /api/applications/:id/attachments/:assetKey{.+}": "signed-in",
    "GET /api/applications/:id/pdf": "signed-in",
    "GET /api/applications/mine": "signed-in",
    "GET /api/applications/options": "signed-in",
    "GET /api/assets/:key{.+}": "public",
    "GET /api/assets/metadata/:key{.+}": "public",
    "GET /api/auth/*": "public",
    "GET /api/auth/.well-known/openid-configuration": "public",
    "GET /api/banners": "permission",
    "GET /api/banners/visible": "public",
    "GET /api/contracts": "permission",
    "GET /api/contracts/active": "signed-in",
    "GET /api/contracts/groups/:groupSlug/signatures": "permission",
    "GET /api/contracts/my-signature": "signed-in",
    "GET /api/contracts/signed-pdf": "signed-in",
    "GET /api/contracts/signed-pdf/:userId": "permission",
    "GET /api/event": "public",
    "GET /api/event/:eventId": "public",
    "GET /api/event/:eventId/allergies": "permission",
    "GET /api/event/:eventId/forms": "signed-in",
    "GET /api/event/:eventId/forms/:type": "signed-in",
    "GET /api/event/:eventId/messages": "permission",
    "GET /api/event/:eventId/payments": "permission",
    "GET /api/event/:eventId/registration": "signed-in",
    "GET /api/event/calendar/:token/events.ics": "public",
    "GET /api/event/favorite": "signed-in",
    "GET /api/event/my-registrations": "signed-in",
    "GET /api/event/my-upcoming-registrations": "signed-in",
    "GET /api/event/strikes": "permission",
    "GET /api/event/strikes/members": "permission",
    "GET /api/feedback": "signed-in",
    "GET /api/feedback/:id": "signed-in",
    "GET /api/feedback/:id/comments": "signed-in",
    "GET /api/forms": "signed-in",
    "GET /api/forms/:formId/submissions": "signed-in",
    "GET /api/forms/:formId/submissions/:id": "signed-in",
    "GET /api/forms/:formId/submissions/download": "signed-in",
    "GET /api/forms/:formId/submissions/me": "signed-in",
    "GET /api/forms/:id": "signed-in",
    "GET /api/forms/:id/statistics": "signed-in",
    "GET /api/galleries": "signed-in",
    "GET /api/galleries/:slug": "signed-in",
    "GET /api/galleries/:slug/pictures": "signed-in",
    "GET /api/groups": "public",
    "GET /api/groups/:groupSlug/fines": "signed-in",
    "GET /api/groups/:groupSlug/fines/:fineId": "signed-in",
    "GET /api/groups/:groupSlug/fines/:fineId/image": "public",
    "GET /api/groups/:groupSlug/fines/statistics": "signed-in",
    "GET /api/groups/:groupSlug/fines/users": "signed-in",
    "GET /api/groups/:groupSlug/join-requests": "permission",
    "GET /api/groups/:groupSlug/laws": "signed-in",
    "GET /api/groups/:groupSlug/leader-permissions": "signed-in",
    "GET /api/groups/:groupSlug/member-permissions": "signed-in",
    "GET /api/groups/:groupSlug/members": "public",
    "GET /api/groups/:groupSlug/members/history": "public",
    "GET /api/groups/:groupSlug/positions": "signed-in",
    "GET /api/groups/:slug": "public",
    "GET /api/groups/:slug/forms": "signed-in",
    "GET /api/groups/join-requests": "signed-in",
    "GET /api/groups/mine": "signed-in",
    "GET /api/institutes": "public",
    "GET /api/jobs": "public",
    "GET /api/jobs/:id": "public",
    "GET /api/news": "public",
    "GET /api/news/:id": "public",
    "GET /api/notification": "signed-in",
    "GET /api/roles": "permission",
    "GET /api/toddel": "public",
    "GET /api/user": "permission",
    "GET /api/user/:id": "signed-in",
    "GET /api/user/:id/allergies": "permission",
    "GET /api/user/allergy": "public",
    "GET /api/user/me/calendar": "signed-in",
    "GET /api/user/me/settings": "signed-in",
    "GET /api/user/me/unanswered-evaluations": "signed-in",
    "GET /api/user/search": "permission",
    "GET /api/version": "public",
    "GET /docs": "public",
    "GET /openapi": "public",
    "PATCH /api/admin/users/:id/email": "permission",
    "PATCH /api/api-keys/:id": "permission",
    "PATCH /api/applications/:id/status": "permission",
    "PATCH /api/banners/:id": "permission",
    "PATCH /api/contracts/:id/activate": "permission",
    "PATCH /api/event/:eventId/registration/:userId/attendance": "permission",
    "PATCH /api/feedback/:id": "permission",
    "PATCH /api/forms/:id": "signed-in",
    "PATCH /api/galleries/:slug": "permission",
    "PATCH /api/galleries/:slug/pictures/:pictureId": "permission",
    "PATCH /api/groups/:groupSlug/fines/:fineId": "signed-in",
    "PATCH /api/groups/:groupSlug/fines/batch": "signed-in",
    "PATCH /api/groups/:groupSlug/fines/users/:userId/batch": "signed-in",
    "PATCH /api/groups/:groupSlug/laws/:lawId": "signed-in",
    "PATCH /api/groups/:groupSlug/leader-permissions": "signed-in",
    "PATCH /api/groups/:groupSlug/member-permissions": "signed-in",
    "PATCH /api/groups/:groupSlug/members/:userId": "permission",
    "PATCH /api/groups/:groupSlug/positions/:positionId": "signed-in",
    "PATCH /api/groups/:slug": "permission",
    "PATCH /api/jobs/:id": "permission",
    "PATCH /api/news/:id": "permission",
    "PATCH /api/notification/:id/read": "signed-in",
    "PATCH /api/notification/read-all": "signed-in",
    "PATCH /api/roles/:roleId": "permission",
    "PATCH /api/toddel/:edition": "permission",
    "PATCH /api/user/:id/baseline-role": "permission",
    "PATCH /api/user/:id/status": "permission",
    "PATCH /api/user/:id/study": "permission",
    "PATCH /api/user/:id/study-year": "permission",
    "PATCH /api/user/me/settings": "signed-in",
    "POST /api/account-link/help": "public",
    "POST /api/account-link/sync": "signed-in",
    "POST /api/api-keys": "permission",
    "POST /api/api-keys/:id/regenerate": "permission",
    "POST /api/api-keys/validate": "public",
    "POST /api/applications/:id/pdf/regenerate": "permission",
    "POST /api/applications/expense": "signed-in",
    "POST /api/applications/hs-case": "signed-in",
    "POST /api/applications/sports-support": "signed-in",
    "POST /api/applications/support": "signed-in",
    "POST /api/assets": "signed-in",
    "POST /api/assets/promote/:key{.+}": "signed-in",
    "POST /api/auth/*": "public",
    "POST /api/banners": "permission",
    "POST /api/company/contact": "public",
    "POST /api/contracts": "permission",
    "POST /api/contracts/sign": "signed-in",
    "POST /api/email/send": "api-key",
    "POST /api/event": "permission",
    "POST /api/event/:eventId/forms": "signed-in",
    "POST /api/event/:eventId/messages": "permission",
    "POST /api/event/:eventId/messages/test": "permission",
    "POST /api/event/:eventId/payment": "signed-in",
    "POST /api/event/:eventId/payment/confirm": "signed-in",
    "POST /api/event/:eventId/payments/:paymentId/refund": "permission",
    "POST /api/event/:eventId/reactions": "signed-in",
    "POST /api/event/:eventId/registration": "signed-in",
    "POST /api/event/:eventId/registration/:userId": "permission",
    "POST /api/event/payment/webhook": "public",
    "POST /api/event/strikes": "permission",
    "POST /api/feedback": "signed-in",
    "POST /api/feedback/:id/comments": "permission",
    "POST /api/forms": "permission",
    "POST /api/forms/:formId/submissions": "signed-in",
    "POST /api/galleries": "permission",
    "POST /api/galleries/:slug/pictures": "permission",
    "POST /api/groups": "permission",
    "POST /api/groups/:groupSlug/fines": "signed-in",
    "POST /api/groups/:groupSlug/join": "signed-in",
    "POST /api/groups/:groupSlug/join-requests/:userId/approve": "permission",
    "POST /api/groups/:groupSlug/join-requests/:userId/decline": "permission",
    "POST /api/groups/:groupSlug/laws": "signed-in",
    "POST /api/groups/:groupSlug/leave": "signed-in",
    "POST /api/groups/:groupSlug/members": "permission",
    "POST /api/groups/:groupSlug/positions": "signed-in",
    "POST /api/groups/:groupSlug/positions/:positionId/holders": "signed-in",
    "POST /api/groups/:slug/archive": "permission",
    "POST /api/groups/:slug/forms": "signed-in",
    "POST /api/groups/:slug/unarchive": "permission",
    "POST /api/jobs": "permission",
    "POST /api/news": "permission",
    "POST /api/news/:id/reactions": "signed-in",
    "POST /api/notification/device": "signed-in",
    "POST /api/roles": "permission",
    "POST /api/roles/:roleId/users": "permission",
    "POST /api/toddel": "permission",
    "POST /api/user/:id/approve": "permission",
    "POST /api/user/me/calendar/regenerate": "signed-in",
    "POST /api/user/me/settings": "signed-in",
    "POST /api/user/register": "signed-in",
    "PUT /api/event/:id": "permission",
    "PUT /api/event/favorite/:id": "signed-in",
    "PUT /api/feedback/:id/vote": "signed-in",
    "PUT /api/user/:id/allergies": "permission",
};

const PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000000";

function registeredRoutes(ctx: {
    app: { routes: { method: string; path: string }[] };
}) {
    return [
        ...new Set(
            ctx.app.routes
                // `.use()` registers its middleware under ALL.
                .filter((route) => route.method !== "ALL")
                .map((route) => `${route.method} ${route.path}`),
        ),
    ];
}

function requestFor(key: string, headers?: Record<string, string>) {
    const [method = "", path = ""] = key.split(" ");
    const url = path
        .replaceAll(/:[^/]+/g, PLACEHOLDER_ID)
        .replace("/*", "/placeholder");

    return [
        url,
        {
            method,
            headers: { "Content-Type": "application/json", ...headers },
            body: method === "GET" ? undefined : "{}",
        },
    ] as const;
}

const routesWith = (...decisions: AccessDecision[]) =>
    Object.entries(ROUTE_ACCESS)
        .filter(([, decision]) => decisions.includes(decision))
        .map(([key]) => key);

describe("route access decisions", () => {
    integrationTest("every route has one", ({ ctx }) => {
        const missing = registeredRoutes(ctx).filter(
            (key) => !(key in ROUTE_ACCESS),
        );

        expect(missing).toEqual([]);
    });

    integrationTest("none outlives its route", ({ ctx }) => {
        const registered = new Set(registeredRoutes(ctx));
        const stale = Object.keys(ROUTE_ACCESS).filter(
            (key) => !registered.has(key),
        );

        expect(stale).toEqual([]);
    });

    integrationTest(
        "non-public routes refuse a signed-out caller",
        async ({ ctx }) => {
            const open: string[] = [];
            for (const key of routesWith(
                "api-key",
                "signed-in",
                "permission",
            )) {
                const res = await ctx.app.request(...requestFor(key));
                if (res.status !== 401) open.push(`${key} -> ${res.status}`);
            }

            expect(open).toEqual([]);
        },
    );

    integrationTest(
        "permission routes refuse a member without grants",
        async ({ ctx }) => {
            const member = await ctx.utils.createTestUser();
            const signIn = await ctx.auth.api.signInEmail({
                body: { email: member.email, password: member.password },
                returnHeaders: true,
            });
            const cookie =
                signIn.headers.getSetCookie()[0]?.split(";")[0] ?? "";

            const open: string[] = [];
            for (const key of routesWith("permission")) {
                const res = await ctx.app.request(
                    ...requestFor(key, { Cookie: cookie }),
                );
                if (res.status !== 403) open.push(`${key} -> ${res.status}`);
            }

            expect(open).toEqual([]);
        },
    );
});
