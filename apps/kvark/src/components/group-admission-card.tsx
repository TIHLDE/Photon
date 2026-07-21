import { Link } from "@tanstack/react-router";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@tihlde/ui/ui/collapsible";
import { Spinner } from "@tihlde/ui/ui/spinner";
import { ArrowRight, ChevronDown, Lock } from "lucide-react";

import { GroupIdentity } from "#/components/group-identity";
import { cn } from "#/lib/utils";

export type AdmissionGroup = {
    name: string;
    slug: string;
    email?: string;
    logoUrl?: string;
};

/**
 * State of a group's admission form, as far as the current viewer is
 * concerned. Resolved by the container that owns the query.
 */
export type AdmissionStatus =
    | "unauthenticated"
    | "loading"
    | "missing"
    | "closed"
    | "answered"
    | "open";

type GroupAdmissionCardProps = {
    group: AdmissionGroup;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    status: AdmissionStatus;
};

/**
 * A group on the /opptak page. Collapsed it shows the group's identity;
 * expanded it shows the state of that group's admission form.
 */
export function GroupAdmissionCard({
    group,
    open,
    onOpenChange,
    status,
}: GroupAdmissionCardProps) {
    return (
        <Card size="sm" className="h-full">
            <Collapsible open={open} onOpenChange={onOpenChange}>
                <CollapsibleTrigger
                    render={
                        <button
                            type="button"
                            className="flex w-full cursor-pointer items-center gap-3 text-left"
                        />
                    }
                >
                    <GroupIdentity {...group} />
                    <ChevronDown
                        className={cn(
                            "size-4 shrink-0 transition-transform",
                            open && "rotate-180",
                        )}
                    />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="flex flex-col gap-2 px-0 pt-4">
                        <AdmissionAction group={group} status={status} />
                        <Button
                            variant="ghost"
                            className="w-full"
                            nativeButton={false}
                            render={
                                <Link
                                    to="/grupper/$slug"
                                    params={{ slug: group.slug }}
                                />
                            }
                        >
                            Les mer
                            <ArrowRight />
                        </Button>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}

function AdmissionAction({
    group,
    status,
}: {
    group: AdmissionGroup;
    status: AdmissionStatus;
}) {
    switch (status) {
        case "unauthenticated":
            return (
                <p className="text-sm text-muted-foreground">
                    Du må være innlogget for å se opptaksskjemaet.
                </p>
            );
        case "loading":
            return (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" />
                    Laster inn opptaksskjema...
                </div>
            );
        case "missing":
            return (
                <p className="text-center text-sm text-muted-foreground">
                    Ingen opptaksskjemaer funnet
                </p>
            );
        case "closed":
            return (
                <Button disabled variant="outline" className="w-full">
                    <Lock />
                    Ikke åpnet
                </Button>
            );
        case "answered":
            return (
                <Button disabled className="w-full">
                    Søkt
                </Button>
            );
        case "open":
            return (
                <Button
                    className="w-full"
                    nativeButton={false}
                    render={
                        <Link
                            to="/grupper/$slug"
                            params={{ slug: group.slug }}
                        />
                    }
                >
                    Søk nå
                    <ArrowRight />
                </Button>
            );
    }
}

/**
 * Plain link card, used for groups that do not run an admission
 * (interessegrupper, idrettslag).
 */
export function GroupAdmissionLinkCard({ group }: { group: AdmissionGroup }) {
    return (
        <Link
            className="block cursor-pointer"
            to="/grupper/$slug"
            params={{ slug: group.slug }}
        >
            <Card size="sm" className="h-full cursor-pointer">
                <CardContent className="flex items-center gap-3">
                    <GroupIdentity {...group} />
                    <ArrowRight className="size-4 shrink-0" />
                </CardContent>
            </Card>
        </Link>
    );
}
