import { createFileRoute } from "@tanstack/react-router";
import { BookmarkIcon } from "lucide-react";

import { Card, CardContent } from "@tihlde/ui/ui/card";

import { AdminEmptyState } from "#/components/admin-empty-state";
import { AdminPageHeader } from "#/components/admin-page-header";

export const Route = createFileRoute("/admin/bannere")({
    component: BannersAdminPage,
    loader: () => ({ breadcrumbs: "Bannere" }),
});

function BannersAdminPage() {
    return (
        <div className="container mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
            <AdminPageHeader
                title="Bannere"
                description="Tidsstyrte toppbannere for viktige beskjeder på forsiden."
            />

            <Card>
                <CardContent>
                    <AdminEmptyState
                        icon={BookmarkIcon}
                        title="Venter på API-endepunkt"
                        description="Bannerhåndtering krever et banner-endepunkt i API-et, som ennå ikke finnes. Når det er på plass, vil denne siden la deg opprette, tidsstyre og publisere bannere."
                    />
                </CardContent>
            </Card>
        </div>
    );
}
