import { createFileRoute } from "@tanstack/react-router";
import { NewsForm } from "~/components/admin/news-form";

export const Route = createFileRoute("/_main/admin/nyheter/ny")({
    component: CreateNewsPage,
});

function CreateNewsPage() {
    return (
        <div className="space-y-4">
            <h1 className="font-heading text-2xl font-bold">Ny artikkel</h1>
            <NewsForm />
        </div>
    );
}
