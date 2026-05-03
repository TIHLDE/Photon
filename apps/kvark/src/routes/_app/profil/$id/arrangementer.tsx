import { createFileRoute } from "@tanstack/react-router";
import { TestComponent } from "./-components/this-is-a-component";

export const Route = createFileRoute("/_app/profil/$id/arrangementer")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <div className="flex flex-col gap-5">
            <div className=" w-full h-10">
                <TestComponent />
            </div>
        </div>
    );
}
