import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

import { TihldeLogo } from "#/components/icons/tihlde";

export const Route = createFileRoute("/_auth")({ component: AuthLayout });

function AuthLayout() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
            <Link
                to="/"
                className="flex items-center gap-1"
                style={{ color: "var(--color-logo, currentColor)" }}
            >
                <div className="size-14">
                    <TihldeLogo />
                </div>
                <span className="text-3xl font-stretch-condensed font-extrabold">
                    TIHLDE
                </span>
            </Link>
            <div className="w-full max-w-md">
                <Outlet />
            </div>
        </div>
    );
}
