import { createFileRoute } from "@tanstack/react-router";
import { LogsIcon } from "lucide-react";

import { Card, CardContent } from "@tihlde/ui/ui/card";

import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";

export const Route = createFileRoute("/admin/_super-admin/logs")({
    component: LogsPage,
    loader: () => ({ breadcrumbs: "Logs" }),
});

function LogsPage() {
    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Logs"
                description="Applikasjons- og revisjonslogger."
            />

            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={LogsIcon}
                        title="Venter på logg-endepunkt"
                        description="API-et eksponerer ennå ikke strukturerte logger. Når et logg-endepunkt finnes, vil denne siden vise og filtrere hendelser her. I mellomtiden ligger runtime-logger hos hosting-plattformen (Railway)."
                    />
                </CardContent>
            </Card>
        </div>
    );
}
