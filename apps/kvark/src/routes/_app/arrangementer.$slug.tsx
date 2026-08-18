import { useRef } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { MarkdownView } from "@tihlde/ui/complex/markdown";
import { Button } from "@tihlde/ui/ui/button";
import { Separator } from "@tihlde/ui/ui/separator";
import {
    ArrowLeft,
    CalendarDays,
    CalendarPlus,
    GraduationCap,
    MapPin,
    PencilLine,
    QrCode,
    Star,
    StarOff,
    UserRound,
    UsersRound,
} from "lucide-react";

import { authQueryOptions } from "#/api/auth";
import {
    getEventByIdQuery,
    getEventRegistrationsInfiniteQuery,
    getFavoriteEventsQuery,
    registerForEventMutation,
    unregisterFromEventMutation,
    updateFavoriteEventMutation,
} from "#/api/queries/events";
import { DetailDateRange } from "#/components/detail-date-range";
import { DetailField } from "#/components/detail-field";
import { DetailHero } from "#/components/detail-hero";
import { DetailIdentity } from "#/components/detail-identity";
import { DetailPage } from "#/components/detail-page";
import { DetailsCard } from "#/components/details-card";
import { EventQrDialog } from "#/components/event-qr-dialog";
import { EventRegistrantsDialog } from "#/components/event-registrants-dialog";
import { EventRegistrationCard } from "#/components/event-registration-card";
import { EventRulesConsent } from "#/components/event-rules-consent";
import { IconActionButton } from "#/components/icon-action-button";
import { MapLink } from "#/components/map-link";
import { richRegistry } from "#/components/markdown/directives/presets";
import { ShareButton } from "#/components/share-button";
import { useEventRulesConsent } from "#/hooks/use-event-rules-consent";
import { useCanActOnResource, usePermission } from "#/hooks/use-permission";
import { buildGoogleCalendarUrl } from "#/lib/calendar-url";
import { buildMapsUrls } from "#/lib/maps";
import {
    deriveRegistrationState,
    formatTimeUntil,
    toEventDeadline,
    formatEventDate,
    formatEventPrice,
    formatEventTime,
    registrationErrorMessage,
    registrationPollInterval,
    TICKET_RESALE_GROUP_URL,
} from "#/lib/event";

export const Route = createFileRoute("/_app/arrangementer/$slug")({
    component: EventDetailPage,
    loader: ({ context, params }) =>
        context.queryClient.ensureQueryData(getEventByIdQuery(params.slug)),
});

function EventDetailPage() {
    const { slug } = Route.useParams();
    const navigate = useNavigate();

    // En fersk påmelding ligger som «pending» til serveren har avgjort plass
    // eller venteliste. Vi poller til den er avklart, ellers ville brukeren
    // blitt stående i behandling til de lastet siden på nytt. Intervallet
    // trappes ned med hvor lenge den har stått — se
    // `registrationPollInterval`.
    const pendingSinceRef = useRef<number | null>(null);
    const { data: event } = useSuspenseQuery({
        ...getEventByIdQuery(slug),
        refetchInterval: (query) => {
            if (query.state.data?.registration?.status !== "pending") {
                pendingSinceRef.current = null;
                return false;
            }
            pendingSinceRef.current ??= Date.now();
            return registrationPollInterval(
                Date.now() - pendingSinceRef.current,
            );
        },
        // Pollingen står ellers stille når fanen ikke er i forgrunnen, og en
        // bruker som bytter fane mens vi behandler ville kommet tilbake til
        // «Behandler påmeldingen din …» som aldri gikk videre.
        refetchIntervalInBackground: true,
    });
    const { data: session } = useQuery(authQueryOptions);

    // Same rule as the API: the permission (a group-scoped one counts), or
    // having created the event.
    const isAdmin = useCanActOnResource([
        "events:update",
        "events:manage",
        "events:delete",
    ])(event.createdById);

    // Deltakerlisten er for medlemmer som selv kan melde seg på: den som kan
    // stille i rommet får se hvem andre som kommer. Utloggede og alumner får
    // antallet fra arrangementet selv, og ville bare fått 401/tomt her.
    const canRegisterSelf = usePermission("events:registrations:create");
    const canSeeRegistrants =
        Boolean(session) &&
        event.requiresSigningUp &&
        (canRegisterSelf || isAdmin);

    const {
        data: registrationPages,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
    } = useInfiniteQuery({
        ...getEventRegistrationsInfiniteQuery(event.id),
        enabled: canSeeRegistrants,
    });

    const eventRules = useEventRulesConsent();
    const registerMutation = useMutation(registerForEventMutation);
    const unregisterMutation = useMutation(unregisterFromEventMutation);
    const favoriteMutation = useMutation(updateFavoriteEventMutation);

    // Arrangementet sier ikke selv om det er en favoritt, så favorittlisten —
    // som uansett ligger i cachen fra profilen — avgjør det.
    const { data: favorites } = useQuery({
        ...getFavoriteEventsQuery(),
        enabled: Boolean(session),
    });
    const isFavorite = Boolean(
        favorites?.some((favorite) => favorite.eventId === event.id),
    );
    const organizerSlug = event.organizer?.slug;

    const registrationState = deriveRegistrationState({
        registration: event.registration,
        closed: event.closed,
        requiresSigningUp: event.requiresSigningUp,
        isPaidEvent: event.isPaidEvent,
        registrationStart: event.registrationStart,
        registrationEnd: event.registrationEnd,
        endTime: event.endTime,
        capacity: event.capacity,
        registeredCount: event.registeredCount,
    });
    // Feil fra på- eller avmelding. Uten dette så knappen ut til å ikke gjøre
    // noe når API-et avviste forsøket.
    const failedAction = registerMutation.error ?? unregisterMutation.error;
    const registrationError = failedAction
        ? registrationErrorMessage(failedAction)
        : null;

    const price = formatEventPrice(event.isPaidEvent, event.payInfo?.price);
    const registeredCount = event.registeredCount;
    const registrants = (registrationPages?.pages ?? []).flatMap((page) =>
        page.registeredUsers.map((u) => ({
            id: u.id,
            name: u.name,
            allowPhoto: u.allowPhoto,
        })),
    );
    const registrantsTotalCount = registrationPages?.pages[0]?.totalCount;
    // API-et gir `nextPage` også for siden etter den siste (sidetallene er
    // nullbaserte, grensen er ikke), så antallet avgjør når vi er ferdige.
    const hasMoreRegistrants =
        hasNextPage && registrants.length < (registrantsTotalCount ?? 0);

    // Kun steder som er valgt fra adressesøket har koordinater, og bare de
    // blir en kartlenke.
    const locationLabel = event.location ?? "";
    const mapsUrls = buildMapsUrls({
        label: locationLabel,
        lat: event.locationLat,
        lng: event.locationLng,
    });
    const locationValue = mapsUrls ? (
        <MapLink label={locationLabel} urls={mapsUrls} />
    ) : (
        locationLabel
    );

    const calendarUrl = buildGoogleCalendarUrl({
        title: event.title,
        location: event.location ?? "",
        start: { iso: event.startTime },
        end: { iso: event.endTime },
    });

    function handleRegister() {
        if (!session) {
            navigate({ to: "/login", search: { redirectTo: location.href } });
            return;
        }
        // Bildesamtykket ligger på profilen, så påmeldingen sender det ikke —
        // API-et henter kontoinnstillingen selv.
        registerMutation.mutate({ eventId: event.id });
    }

    function handleUnregister() {
        unregisterMutation.mutate({ eventId: event.id });
    }

    return (
        <DetailPage
            back={
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link to="/arrangementer" />}
                    >
                        <ArrowLeft />
                        Alle arrangementer
                    </Button>
                </div>
            }
            hero={
                <DetailHero
                    imageUrl={event.image ?? undefined}
                    alt={event.imageAlt ?? undefined}
                />
            }
            header={
                <>
                    <div className="flex items-center justify-between gap-2">
                        {organizerSlug ? (
                            <Link
                                to="/grupper/$slug"
                                params={{ slug: organizerSlug }}
                                className="flex min-w-0"
                            >
                                <DetailIdentity
                                    name={event.organizer?.name ?? "TIHLDE"}
                                    logoUrl={
                                        event.organizer?.image ?? undefined
                                    }
                                />
                            </Link>
                        ) : (
                            <DetailIdentity
                                name={event.organizer?.name ?? "TIHLDE"}
                                logoUrl={event.organizer?.image ?? undefined}
                            />
                        )}
                        <div className="flex items-center gap-1">
                            {session ? (
                                <IconActionButton
                                    icon={isFavorite ? StarOff : Star}
                                    // Favoritt er også påmeldingsvarselet, så
                                    // knappen sier hva den faktisk gjør.
                                    label={
                                        isFavorite
                                            ? "Fjern fra favoritter – skrur av varselet"
                                            : "Legg til i favoritter – få varsel én time før påmeldingen åpner"
                                    }
                                    onClick={() =>
                                        favoriteMutation.mutate({
                                            eventId: event.id,
                                            data: { isFavorite: !isFavorite },
                                        })
                                    }
                                />
                            ) : null}
                            <ShareButton label="Del arrangement" />
                            {isAdmin ? (
                                <IconActionButton
                                    icon={PencilLine}
                                    label="Rediger arrangement"
                                    render={
                                        <Link
                                            to="/admin/arrangementer/$eventId"
                                            params={{ eventId: event.id }}
                                        />
                                    }
                                />
                            ) : null}
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl">{event.title}</h1>

                    <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 lg:flex">
                        <DetailField
                            icon={CalendarDays}
                            value={`${formatEventDate(event.startTime)}, kl. ${formatEventTime(event.startTime)}`}
                        />
                        <DetailField icon={MapPin} value={locationValue} />
                    </div>
                </>
            }
            body={
                event.description ? (
                    <>
                        <Separator />
                        <MarkdownView
                            registry={richRegistry}
                            source={event.description}
                        />
                    </>
                ) : null
            }
            sidebar={
                <>
                    <DetailsCard
                        title="Detaljer"
                        items={[
                            <DetailDateRange
                                start={{
                                    date: formatEventDate(event.startTime),
                                    time: formatEventTime(event.startTime),
                                }}
                                end={{
                                    date: formatEventDate(event.endTime),
                                    time: formatEventTime(event.endTime),
                                }}
                                action={
                                    <IconActionButton
                                        icon={CalendarPlus}
                                        label="Legg til i kalender"
                                        render={
                                            <a
                                                href={calendarUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            />
                                        }
                                    />
                                }
                            />,
                            <DetailField icon={MapPin} value={locationValue} />,
                            ...(event.restrictedToInstitute
                                ? [
                                      <DetailField
                                          icon={GraduationCap}
                                          label="Kun for"
                                          value={`Studenter ved ${event.restrictedToInstitute.shortName}`}
                                      />,
                                  ]
                                : []),
                            ...(event.contactPerson
                                ? [
                                      <DetailField
                                          icon={UserRound}
                                          label="Kontaktperson"
                                          value={
                                              // E-posten deles kun med innloggede
                                              // medlemmer, så den mangler for
                                              // utloggede besøkende.
                                              event.contactPerson.email ? (
                                                  <a
                                                      href={`mailto:${event.contactPerson.email}`}
                                                  >
                                                      {event.contactPerson.name}
                                                  </a>
                                              ) : (
                                                  event.contactPerson.name
                                              )
                                          }
                                      />,
                                  ]
                                : []),
                        ]}
                    />

                    <EventRegistrationCard
                        registrationState={registrationState}
                        registrationOpensAt={
                            event.registrationStart
                                ? toEventDeadline(event.registrationStart)
                                : undefined
                        }
                        registrationOpensInLabel={
                            registrationState === "not-open" &&
                            event.registrationStart
                                ? formatTimeUntil(event.registrationStart)
                                : undefined
                        }
                        registrationClosesAt={
                            event.registrationEnd
                                ? toEventDeadline(event.registrationEnd)
                                : undefined
                        }
                        capacity={event.capacity}
                        registeredCount={registeredCount}
                        waitlistCount={event.waitlistCount}
                        isAdmin={isAdmin}
                        price={price}
                        onRegister={handleRegister}
                        // Ventelista er samme påmelding: serveren avgjør om
                        // det ble plass eller kø.
                        onJoinWaitlist={handleRegister}
                        onUnregister={handleUnregister}
                        isSubmitting={
                            registerMutation.isPending ||
                            unregisterMutation.isPending
                        }
                        actionError={registrationError}
                        requiresEventRulesConsent={eventRules.mustAccept}
                        eventRulesSlot={
                            <EventRulesConsent
                                variant="inline"
                                message={
                                    registrationState === "not-open"
                                        ? "Gjør det nå, så er du klar når påmeldingen åpner."
                                        : "Huk av, så kan du melde deg på med én gang."
                                }
                                onAccept={eventRules.acceptEventRules}
                                isSubmitting={eventRules.isSubmitting}
                                error={eventRules.error}
                            />
                        }
                        waitlistPosition={
                            event.registration?.waitlistPosition ?? undefined
                        }
                        // Har man betalt for plassen sin, er billetten noe man
                        // kan bli sittende igjen med. Da tilbyr vi samme utvei
                        // som før: legg den ut i Facebook-gruppa.
                        ticketResaleUrl={
                            event.registration?.hasPaid
                                ? TICKET_RESALE_GROUP_URL
                                : undefined
                        }
                        headerSlot={
                            canSeeRegistrants ? (
                                <EventRegistrantsDialog
                                    title={event.title}
                                    registrants={registrants}
                                    totalCount={registrantsTotalCount}
                                    hasMore={hasMoreRegistrants}
                                    isLoadingMore={isFetchingNextPage}
                                    onLoadMore={() => {
                                        void fetchNextPage();
                                    }}
                                    trigger={
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label="Se alle påmeldte"
                                        >
                                            <UsersRound />
                                        </Button>
                                    }
                                />
                            ) : null
                        }
                        qrSlot={
                            registrationState === "joined" ? (
                                <EventQrDialog
                                    title={event.title}
                                    registrantName={
                                        session?.user?.name ?? "Deltaker"
                                    }
                                    trigger={
                                        <Button className="w-full">
                                            <QrCode />
                                            Påmeldingsbevis
                                        </Button>
                                    }
                                />
                            ) : null
                        }
                    />
                </>
            }
        />
    );
}
