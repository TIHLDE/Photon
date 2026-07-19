import { createFileRoute } from "@tanstack/react-router";
import { DatabaseIcon } from "lucide-react";

import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";

import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";

export const Route = createFileRoute("/admin/_super-admin/database")({
    component: DatabaseViewerPage,
    loader: () => ({ breadcrumbs: "Database Viewer" }),
});

function DatabaseViewerPage() {
    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Database Viewer"
                description="Inspiser databasen direkte for feilsøking."
            />

            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={DatabaseIcon}
                        title="Bruk Drizzle Studio"
                        description="Kvark eksponerer ikke database-innhold over API-et av sikkerhetsgrunner. For direkte inspeksjon i utvikling, bruk Drizzle Studio."
                    >
                        <Button
                            variant="outline"
                            render={
                                <a
                                    href="https://orm.drizzle.team/docs/drizzle-kit-studio"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Om Drizzle Studio
                                </a>
                            }
                        />
                    </AdminEmptyState>
                </CardContent>
            </Card>
        </div>
    );
}
