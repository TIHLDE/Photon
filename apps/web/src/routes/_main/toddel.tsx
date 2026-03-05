import { createFileRoute } from "@tanstack/react-router";
import { Page } from "~/components/layout/page";

export const Route = createFileRoute("/_main/toddel")({
    component: ToddelPage,
});

function ToddelPage() {
    return (
        <Page className="max-w-3xl">
            <div className="space-y-6">
                <header className="space-y-2">
                    <h1 className="font-heading text-4xl font-bold">
                        TIHLDE-toddel
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        TIHLDE sitt studentmagasin
                    </p>
                </header>
                <p className="text-muted-foreground">Innhold kommer snart.</p>
            </div>
        </Page>
    );
}
