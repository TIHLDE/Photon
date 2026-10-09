import { describe, expect, test } from "bun:test";
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";

import { groupSearchSchema } from "#/lib/group-search";
import { NotificationItem } from "./notification-item";

describe("fine notification link", () => {
    test("renders one query string with the destination tab and fine ID", async () => {
        const botId = "1a3d48fb-aea6-4334-80d5-fbb65df4c5b0";
        const notification = (
            <NotificationItem
                title="Du har fått en bot"
                description="En bot fra testbrukeren"
                timeLabel="nå"
                isRead={false}
                href={`/grupper/index?tab=boter&botId=${botId}`}
            />
        );
        const rootRoute = createRootRoute({ component: Outlet });
        const groupRoute = createRoute({
            getParentRoute: () => rootRoute,
            path: "/grupper/$slug",
            validateSearch: groupSearchSchema,
            component: () => notification,
        });
        const router = createRouter({
            routeTree: rootRoute.addChildren([groupRoute]),
            history: createMemoryHistory({
                initialEntries: ["/grupper/index?tab=om"],
            }),
            isServer: true,
        });
        await router.load();

        const html = renderToStaticMarkup(
            <RouterContextProvider router={router}>
                {notification}
            </RouterContextProvider>,
        );
        expect(html).toContain(
            `href="/grupper/index?tab=boter&amp;botId=${botId}"`,
        );
        expect(html).not.toContain(`${botId}?tab=om`);
    });
});
