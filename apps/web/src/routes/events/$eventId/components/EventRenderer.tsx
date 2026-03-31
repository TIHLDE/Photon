import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import TIHLDE_LOGO from "~/assets/img/TihldeBackground.jpg";
import DetailContent from "~/components/miscellaneous/DetailContent";
import ShareButton from "~/components/miscellaneous/ShareButton";
import UpdatedAgo from "~/components/miscellaneous/UpdatedAgo";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import ResponsiveAlertDialog from "~/components/ui/responsive-alert-dialog";
import useMediaQuery, { MEDIUM_SCREEN } from "~/hooks/MediaQuery";
import { useOptionalAuth } from "~/hooks/auth";
import type { Event } from "~/api/queries/events";
import { createEventRegistrationMutation, deleteEventRegistrationMutation } from "~/api/queries/events";
import { formatDate } from "~/utils";
import { parseISO } from "date-fns";
import { CalendarIcon, LoaderCircle, PencilIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type EventRendererProps = {
  data: Event;
  preview?: boolean;
};

const EventRenderer = ({ data, preview = false }: EventRendererProps) => {
  const { auth } = useOptionalAuth();
  const user = auth?.user;
  const isDesktop = useMediaQuery(MEDIUM_SCREEN);
  const [isLoadingSignUp, setIsLoadingSignUp] = useState(false);

  const startDate = parseISO(data.startTime);
  const endDate = parseISO(data.endTime);

  const createRegistration = useMutation(createEventRegistrationMutation(data.id));
  const deleteRegistration = useMutation(deleteEventRegistrationMutation(data.id));

  const signUp = () => {
    setIsLoadingSignUp(true);
    createRegistration.mutate({} as never, {
      onSuccess: () => {
        toast.success("Påmeldingen var vellykket");
      },
      onError: () => {
        toast.error("Kunne ikke melde deg på");
      },
      onSettled: () => {
        setIsLoadingSignUp(false);
      },
    });
  };

  const signOff = () => {
    deleteRegistration.mutate(undefined, {
      onSuccess: () => {
        toast.success("Du er nå avmeldt");
      },
      onError: () => {
        toast.error("Kunne ikke melde deg av");
      },
    });
  };

  const RegistrationStatus = () => {
    if (preview || !data.registration) return null;

    const { status, waitlistPosition } = data.registration;

    if (status === "waitlisted") {
      return (
        <>
          <Alert>
            <AlertDescription>Du står på plass {waitlistPosition} på ventelisten, vi gir deg beskjed hvis du får plass</AlertDescription>
          </Alert>
          <ResponsiveAlertDialog
            action={signOff}
            description="Om du melder deg av arrangementet vil du miste plassen din."
            title="Meld deg av arrangementet"
            trigger={
              <Button className="w-full" variant="destructive">
                Meld deg av
              </Button>
            }
          />
        </>
      );
    }

    if (status === "registered" || status === "attended") {
      return (
        <>
          <Alert variant="success">
            <AlertDescription>{status === "attended" ? "Du har deltatt på arrangementet!" : "Du har plass på arrangementet!"}</AlertDescription>
          </Alert>
          {status === "registered" && (
            <ResponsiveAlertDialog
              action={signOff}
              description="Om du melder deg av arrangementet vil du miste plassen din."
              title="Meld deg av arrangementet"
              trigger={
                <Button className="w-full" variant="destructive">
                  Meld deg av
                </Button>
              }
            />
          )}
        </>
      );
    }

    return null;
  };

  const SignUpButton = () => {
    if (preview) return null;

    if (data.closed) {
      return (
        <Alert variant="warning">
          <AlertDescription>Dette arrangementet er stengt.</AlertDescription>
        </Alert>
      );
    }

    if (data.registration) {
      return <RegistrationStatus />;
    }

    if (!user) {
      return (
        <Button asChild className="w-full" size="lg">
          <Link to="/logg-inn">Logg inn for å melde deg på</Link>
        </Button>
      );
    }

    return (
      <Button className="w-full" disabled={isLoadingSignUp} onClick={signUp} size="lg">
        {isLoadingSignUp ? <LoaderCircle className="w-5 h-5 animate-spin" /> : "Meld deg på"}
      </Button>
    );
  };

  const Info = () => (
    <>
      <Card>
        <CardHeader className="py-1 px-4">
          <CardTitle>
            <h1>Detaljer</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-3">
          <DetailContent info={formatDate(startDate)} title="Fra:" />
          <DetailContent info={formatDate(endDate)} title="Til:" />
          {data.location && <DetailContent info={data.location} title="Sted:" />}
          <DetailContent info={data.category.label} title="Hva:" />
          {data.organizer && (
            <DetailContent
              info={
                <Link to="/grupper/$slug" params={{ slug: data.organizer.slug }}>
                  {data.organizer.name}
                </Link>
              }
              title="Arrangør:"
            />
          )}
          {data.payInfo && <DetailContent info={data.payInfo.price + " kr"} title="Pris:" />}
        </CardContent>
      </Card>
      {data.priorityPools.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle>
              <h1>Prioritert</h1>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4 space-y-2">
            {data.priorityPools.map((pool, i) => (
              <div key={i} className="flex flex-wrap gap-1">
                {pool.groups.map((group) => (
                  <Link key={group.slug} className="text-blue-500 dark:text-indigo-300 hover:underline" to="/grupper/$slug" params={{ slug: group.slug }}>
                    {group.name}
                  </Link>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {data.enforcesPreviousStrikes && (
        <Alert>
          <AlertDescription>Dette arrangementet håndhever aktive prikker</AlertDescription>
        </Alert>
      )}
      <SignUpButton />
    </>
  );

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-1 lg:gap-2 lg:mt-2">
      <div className="w-full lg:max-w-[335px] space-y-2">
        {isDesktop && <Info />}
        <Button className="flex items-center space-x-2 w-full" size="lg" variant="outline">
          <CalendarIcon className="stroke-[1.5px] w-5 h-5" />
          <span>Legg til i kalender</span>
        </Button>
      </div>
      <div className="space-y-2 w-full">
        <img alt={data.title} className="rounded-md aspect-auto mx-auto" src={data.image || TIHLDE_LOGO} />

        <div className="space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between">
          <div className="flex items-center space-x-2">
            <ShareButton shareId={data.id} shareType="event" title={data.title} />
            {!preview && (
              <Button className="w-full flex items-center space-x-2" variant="outline">
                <PencilIcon className="w-4 h-4 md:w-5 md:h-5 stroke-[1.5px]" />
                <Link to="/admin/arrangementer/{-$eventId}" params={{ eventId: data.id }} className="text-sm md:text-md text-black dark:text-white">
                  Endre arrangement
                </Link>
              </Button>
            )}
          </div>
        </div>

        {!isDesktop && <Info />}

        <Card>
          <CardHeader className="pt-6 pb-2 px-6">
            <CardTitle className="text-4xl break-words">{data.title}</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-6">
            {/* TODO: Add description/body field when Photon backend supports it */}
            <p className="text-muted-foreground">Arrangementbeskrivelse kommer snart</p>
          </CardContent>
        </Card>

        {data.updatedAt && <UpdatedAgo updatedAt={data.updatedAt} />}
      </div>
    </div>
  );
};

export default EventRenderer;

export const EventRendererLoading = () => (
  <div className="flex flex-col-reverse lg:flex-row gap-1 lg:gap-2 lg:mt-2">
    <div className="w-full lg:max-w-[335px] space-y-2">
      <Skeleton className="w-full h-60" />
      <Skeleton className="w-full h-32" />
      <Skeleton className="w-full h-20" />
    </div>

    <div className="space-y-2 w-full">
      <Skeleton className="w-full h-96" />
      <Skeleton className="w-full h-60" />
    </div>
  </div>
);
