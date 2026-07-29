import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Spinner } from "@tihlde/ui/ui/spinner";

import { authQueryOptions, linkFeideMutationOptions } from "#/api/auth";

/**
 * Where a member lands after confirming their email address.
 *
 * Confirming signs them in (`autoSignInAfterVerification`), which is the whole
 * point: matching by username or email has already failed for them, but a
 * session identifies them outright, so Feide can be attached to *this* user
 * rather than guessed at. After that the login works like everyone else's.
 */
export const Route = createFileRoute("/_auth/koble-feide")({
    component: LinkFeidePage,
});

function LinkFeidePage() {
    return (
        <Suspense fallback={<LinkFeideSkeleton />}>
            <LinkFeideCard />
        </Suspense>
    );
}

function LinkFeideSkeleton() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <Skeleton className="h-6 w-48" />
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
    );
}

function LinkFeideCard() {
    const { data: auth } = useSuspenseQuery(authQueryOptions);
    const navigate = useNavigate();
    const linkMutation = useMutation(linkFeideMutationOptions);

    if (!auth?.user) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Lenken har gått ut</CardTitle>
                    <CardDescription>
                        Logg inn med Feide igjen for å få en ny.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        className="w-full"
                        onClick={() => navigate({ to: "/login" })}
                    >
                        Til innlogging
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Koble Feide til kontoen din</CardTitle>
                <CardDescription>
                    Du er logget inn som {auth.user.name}. Etter dette logger du
                    inn med Feide.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                <Button
                    className="w-full"
                    disabled={linkMutation.isPending}
                    onClick={() => linkMutation.mutate({ callbackURL: "/" })}
                >
                    {linkMutation.isPending ? (
                        <>
                            <Spinner />
                            <span>Kobler...</span>
                        </>
                    ) : (
                        "Koble til Feide"
                    )}
                </Button>
                {linkMutation.isError && (
                    <p className="text-sm text-destructive">
                        {linkMutation.error.message}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
