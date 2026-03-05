import { useQueryClient } from "@tanstack/react-query";
import type { Event } from "@tihlde/sdk/types";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useOptionalAuth } from "~/hooks/use-auth";
import { photon } from "~/lib/api";
import { eventKeys } from "~/lib/queries/events";

type RegistrationCardProps = {
    event: Event;
};

export function RegistrationCard({ event }: RegistrationCardProps) {
    const session = useOptionalAuth();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const registration = event.registration;
    const isRegistered =
        registration?.status === "registered" ||
        registration?.status === "attended";
    const isWaitlisted = registration?.status === "waitlisted";

    const handleRegister = async () => {
        setLoading(true);
        try {
            const { error } = await photon.POST(
                "/api/event/{eventId}/registration",
                {
                    params: { path: { eventId: event.id } },
                },
            );
            if (error) {
                toast.error("Påmelding feilet");
                return;
            }
            await queryClient.invalidateQueries({
                queryKey: eventKeys.detail(event.id),
            });
            toast.success("Du er påmeldt!");
        } catch {
            toast.error("Noe gikk galt");
        } finally {
            setLoading(false);
        }
    };

    const handleUnregister = async () => {
        setLoading(true);
        try {
            const { error } = await photon.DELETE(
                "/api/event/{eventId}/registration",
                {
                    params: { path: { eventId: event.id } },
                },
            );
            if (error) {
                toast.error("Avmelding feilet");
                return;
            }
            await queryClient.invalidateQueries({
                queryKey: eventKeys.detail(event.id),
            });
            toast.success("Du er avmeldt");
        } catch {
            toast.error("Noe gikk galt");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm">Påmelding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {!session && (
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            Du må logge inn for å melde deg på.
                        </p>
                        <a href="/logg-inn">
                            <Button variant="outline" className="w-full">
                                Logg inn
                            </Button>
                        </a>
                    </div>
                )}

                {session && event.closed && !registration && (
                    <Alert>
                        <XCircle className="size-4" />
                        <p className="text-sm">Påmeldingen er stengt.</p>
                    </Alert>
                )}

                {session && !event.closed && !registration && (
                    <Button
                        className="w-full"
                        onClick={handleRegister}
                        disabled={loading}
                    >
                        {loading ? "Melder på..." : "Meld deg på"}
                    </Button>
                )}

                {isRegistered && (
                    <div className="space-y-3">
                        <Alert>
                            <CheckCircle className="size-4 text-green-600" />
                            <p className="text-sm">Du er påmeldt!</p>
                        </Alert>
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleUnregister}
                            disabled={loading}
                        >
                            {loading ? "Melder av..." : "Meld deg av"}
                        </Button>
                    </div>
                )}

                {isWaitlisted && (
                    <div className="space-y-3">
                        <Alert>
                            <Clock className="size-4 text-yellow-600" />
                            <p className="text-sm">
                                Du er på venteliste
                                {registration?.waitlistPosition != null &&
                                    ` (plass ${registration.waitlistPosition})`}
                            </p>
                        </Alert>
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleUnregister}
                            disabled={loading}
                        >
                            {loading ? "Melder av..." : "Meld deg av"}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
