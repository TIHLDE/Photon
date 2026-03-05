import { createFileRoute } from "@tanstack/react-router";
import { Calendar, FileText, Megaphone, Newspaper, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export const Route = createFileRoute("/_main/admin/")({
    component: AdminDashboard,
});

const SECTIONS = [
    {
        title: "Arrangementer",
        icon: Calendar,
        href: "/admin/arrangementer",
        createHref: "/admin/arrangementer/ny",
        description: "Opprett og administrer arrangementer",
    },
    {
        title: "Nyheter",
        icon: Newspaper,
        href: "/admin/nyheter",
        createHref: "/admin/nyheter/ny",
        description: "Publiser og rediger nyhetsartikler",
    },
    {
        title: "Stillingsannonser",
        icon: Megaphone,
        href: "/admin/stillingsannonser",
        createHref: "/admin/stillingsannonser/ny",
        description: "Administrer stillingsannonser",
    },
    {
        title: "Skjemaer",
        icon: FileText,
        href: "/admin/skjemaer",
        createHref: "/admin/skjemaer/ny",
        description: "Bygg og administrer skjemaer",
    },
];

function AdminDashboard() {
    return (
        <div className="space-y-6">
            <h1 className="font-heading text-3xl font-bold">Administrasjon</h1>

            <div className="grid gap-4 sm:grid-cols-2">
                {SECTIONS.map((section) => (
                    <Card key={section.href}>
                        <CardHeader className="flex-row items-center justify-between space-y-0">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <section.icon className="size-4" />
                                {section.title}
                            </CardTitle>
                            <a href={section.createHref}>
                                <Button size="sm">
                                    <Plus className="mr-1 size-3.5" />
                                    Ny
                                </Button>
                            </a>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                {section.description}
                            </p>
                            <a
                                href={section.href}
                                className="mt-2 inline-block text-sm text-primary hover:underline"
                            >
                                Se alle
                            </a>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
