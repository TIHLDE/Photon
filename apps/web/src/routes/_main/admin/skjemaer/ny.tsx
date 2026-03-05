import { createFileRoute } from "@tanstack/react-router";
import { FormBuilder } from "~/components/admin/form-builder";

export const Route = createFileRoute("/_main/admin/skjemaer/ny")({
    component: CreateFormPage,
});

function CreateFormPage() {
    return (
        <div className="space-y-4">
            <h1 className="font-heading text-2xl font-bold">Nytt skjema</h1>
            <FormBuilder />
        </div>
    );
}
