import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useRef } from "react";
import { z } from "zod";
import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Spinner } from "@tihlde/ui/ui/spinner";

import {
    authQueryOptions,
    linkedAccountsQueryOptions,
    linkFeideMutationOptions,
    sanitizeRedirectTo,
} from "#/api/auth";
import { syncFeideAccountMutation } from "#/api/queries/account-link";

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
    validateSearch: z.object({
        // Feide sends the member back here with ?linked, which is what tells
        // this page to finish the job the callback could not.
        linked: z.coerce.boolean().optional(),
        // Where they were headed before login interrupted them. Carried
        // through the Feide round trip so linking does not cost them the
        // page they actually asked for.
        next: z.string().optional(),
    }),
});

function LinkFeidePage() {
    return (
        <Suspense fallback={<LinkFeideSkeleton />}>
            <LinkFeideCard />
        </Suspense>
    );
}

/**
 * The step that only exists because linking cannot sync.
 *
 * Better Auth's link branch writes the account row and redirects without
 * minting a session, and the sync hook keys on that session to learn who
 * logged in — so a linked member ends up with a working login and no study
 * programme, campus or cohort. Five members reached exactly that state in
 * production on 2026-07-30, and nothing in the UI told them.
 *
 * Failure is deliberately not fatal. The link succeeded and they are signed
 * in; the next Feide login syncs them anyway. Trapping them on an error screen
 * over data they will get regardless would be the worse outcome, so this moves
 * them on either way.
 */
function FinishLink({ onDone }: { onDone: () => void }) {
    const syncMutation = useMutation(syncFeideAccountMutation);
    const started = useRef(false);

    useEffect(() => {
        // Guarded: React runs effects twice in development, and syncing is a
        // network round trip to Feide, not a cheap no-op.
        if (started.current) return;
        started.current = true;
        syncMutation.mutate(undefined, { onSettled: onDone });
    }, [syncMutation, onDone]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Henter studieopplysningene dine</CardTitle>
                <CardDescription>Ett øyeblikk.</CardDescription>
            </CardHeader>
            <CardContent>
                <Spinner />
            </CardContent>
        </Card>
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
    const { linked, next } = Route.useSearch();
    const navigate = useNavigate();

    // Hard navigation rather than the router: linking changed the session, and
    // `next` is an arbitrary path the typed router cannot check anyway.
    // Sanitized because it arrives from the URL.
    const goToNext = () => {
        window.location.href = sanitizeRedirectTo(next);
    };

    if (linked && auth?.user) {
        return <FinishLink onDone={goToNext} />;
    }

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
        <Suspense fallback={<LinkFeideSkeleton />}>
            <LinkFeidePrompt
                name={auth.user.name}
                next={sanitizeRedirectTo(next)}
                onSkip={goToNext}
            />
        </Suspense>
    );
}

/**
 * The prompt itself, behind its own boundary so the account lookup does not
 * hold up the "your link expired" branch above — that one has no session, and
 * listing accounts without one is a 401.
 *
 * A member who linked Feide long ago can land here too: any confirmation mail
 * points at this page, including the ones sent for reasons that have nothing
 * to do with linking. Asking them to link again is a dead end with no button
 * out, so they are moved straight on instead.
 */
function LinkFeidePrompt({
    name,
    next,
    onSkip,
}: {
    name: string;
    next: string;
    onSkip: () => void;
}) {
    const { data: accounts } = useSuspenseQuery(linkedAccountsQueryOptions);
    const linkMutation = useMutation(linkFeideMutationOptions);

    const alreadyLinked = accounts.some(
        (account) => account.providerId === "feide",
    );

    const skipped = useRef(false);
    useEffect(() => {
        if (!alreadyLinked || skipped.current) return;
        skipped.current = true;
        onSkip();
    }, [alreadyLinked, onSkip]);

    if (alreadyLinked) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Feide er allerede koblet til</CardTitle>
                    <CardDescription>Sender deg videre.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Spinner />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Koble Feide til kontoen din</CardTitle>
                <CardDescription>
                    Du er logget inn som {name}. Kobler du til Feide, henter vi
                    studieprogram og klasse automatisk, og du logger inn med
                    Feide etterpå.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                <Button
                    className="w-full"
                    disabled={linkMutation.isPending}
                    // Back here rather than to the front page: this is where
                    // the study data gets pulled, since the link itself
                    // cannot. See FinishLink. `next` rides along so the round
                    // trip still ends where the member was headed.
                    onClick={() =>
                        linkMutation.mutate({
                            callbackURL: `/koble-feide?linked=1&next=${encodeURIComponent(next)}`,
                        })
                    }
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
            {/*
             * Not everyone can link: the members who reach this page without
             * Feide are exactly the ones vervrebus verifies by hand. Leaving
             * them no way past would trade one dead end for another.
             */}
            <CardFooter className="justify-center">
                <Button variant="link" onClick={onSkip}>
                    Hopp over — jeg bruker ikke Feide
                </Button>
            </CardFooter>
        </Card>
    );
}
