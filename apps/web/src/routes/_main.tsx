import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { BottomBar } from "~/components/layout/bottom-bar";
import { Footer } from "~/components/layout/footer";
import { Topbar } from "~/components/layout/topbar";

export const Route = createFileRoute("/_main")({
    component: MainLayout,
});

function MainLayout() {
    return (
        <div className="flex min-h-screen flex-col">
            <Suspense>
                <Topbar />
            </Suspense>
            <div className="flex-1 pb-16 md:pb-0">
                <Outlet />
            </div>
            <Footer />
            <Suspense>
                <BottomBar />
            </Suspense>
        </div>
    );
}
