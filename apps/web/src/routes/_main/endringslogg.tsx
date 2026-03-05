import { createFileRoute } from "@tanstack/react-router";
import { Page } from "~/components/layout/page";

export const Route = createFileRoute("/_main/endringslogg")({
    component: ChangelogPage,
});

function ChangelogPage() {
    return (
        <Page className="max-w-3xl">
            <div className="space-y-6">
                <header className="space-y-2">
                    <h1 className="font-heading text-4xl font-bold">
                        Endringslogg
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Se hva som er nytt på tihlde.org
                    </p>
                </header>
                <p className="text-muted-foreground">
                    Endringslogg kommer snart.
                </p>
            </div>
        </Page>
    );
}
