import { createFileRoute } from "@tanstack/react-router";
import { Page } from "~/components/layout/page";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { useOptionalAuth } from "~/hooks/use-auth";

export const Route = createFileRoute("/_main/profil/$userId")({
    component: ProfilePage,
});

function ProfilePage() {
    const { userId } = Route.useParams();
    const session = useOptionalAuth();
    const isOwnProfile = session?.user.id === userId || userId === "meg";

    return (
        <Page>
            <div className="space-y-6">
                <header className="flex items-center gap-4">
                    <div className="flex size-16 items-center justify-center rounded-full bg-muted text-xl font-bold">
                        {session?.user.name
                            ?.split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("") ?? "?"}
                    </div>
                    <div>
                        <h1 className="font-heading text-3xl font-bold">
                            {session?.user.name ?? "Bruker"}
                        </h1>
                        {session?.user.email && (
                            <p className="text-sm text-muted-foreground">
                                {session.user.email}
                            </p>
                        )}
                    </div>
                </header>

                <Separator />

                {isOwnProfile && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Min profil</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Profilinnstillinger kommer snart.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </Page>
    );
}
