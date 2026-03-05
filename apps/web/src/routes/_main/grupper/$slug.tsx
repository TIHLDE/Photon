import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Mail, Users } from "lucide-react";
import { Page } from "~/components/layout/page";
import { MarkdownRenderer } from "~/components/markdown-renderer";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { getGroupQuery, listGroupMembersQuery } from "~/lib/queries/groups";

export const Route = createFileRoute("/_main/grupper/$slug")({
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getGroupQuery(params.slug)),
    component: GroupDetailPage,
});

function GroupDetailPage() {
    const { slug } = Route.useParams();
    const { data: group } = useSuspenseQuery(getGroupQuery(slug));

    if (!group) return null;

    return (
        <Page>
            <div className="space-y-6">
                <a
                    href="/grupper"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    Tilbake til grupper
                </a>

                <header className="flex items-center gap-4">
                    {group.imageUrl ? (
                        <img
                            src={group.imageUrl}
                            alt={group.name}
                            className="size-16 rounded-full object-cover"
                        />
                    ) : (
                        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                            <Users className="size-6 text-muted-foreground" />
                        </div>
                    )}
                    <div>
                        <h1 className="font-heading text-3xl font-bold">
                            {group.name}
                        </h1>
                        <div className="mt-1 flex items-center gap-2">
                            <Badge variant="secondary">{group.type}</Badge>
                            {group.contactEmail && (
                                <a
                                    href={`mailto:${group.contactEmail}`}
                                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                                >
                                    <Mail className="size-3.5" />
                                    {group.contactEmail}
                                </a>
                            )}
                        </div>
                    </div>
                </header>

                {group.description && (
                    <>
                        <Separator />
                        <MarkdownRenderer content={group.description} />
                    </>
                )}

                <Separator />
                <MembersList slug={slug} />
            </div>
        </Page>
    );
}

function MembersList({ slug }: { slug: string }) {
    const { data } = useSuspenseQuery(listGroupMembersQuery(slug));

    if (!data || data.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Ingen medlemmer å vise.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <h2 className="font-heading text-xl font-semibold">Medlemmer</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.map((member) => (
                    <Card
                        key={member.userId}
                        className="flex items-center gap-3 p-3"
                    >
                        <div className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {member.userId.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                                {member.userId}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                                {member.role}
                            </p>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
