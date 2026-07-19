import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({ component: AuthLayout });

function AuthLayout() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
            <Link to="/" className="flex items-center gap-2">
                <div className="size-10 rounded-md bg-muted" aria-hidden />
                <span className="text-lg">TIHLDE</span>
            </Link>
            <div className="w-full max-w-sm">
                <Outlet />
            </div>
        </div>
    );
}
