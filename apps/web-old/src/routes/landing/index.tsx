import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly, createFileRoute, Link, LinkOptions } from "@tanstack/react-router";
import { listEventsQuery, listJobsQuery, listNewsQuery } from "~/api/queries";
import AspectRatioImg from "~/components/miscellaneous/AspectRatioImg";
import InfoBanner from "~/components/miscellaneous/InfoBanner/InfoBanner";
import { Button } from "~/components/ui/button";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { SHOW_FADDERUKA_INFO, SHOW_NEW_STUDENT_INFO } from "~/constant";
import { useIsAuthenticated, useOptionalAuth } from "~/hooks/auth";
import { analyticsEvent, usePersistedState } from "~/hooks/Utils";
import EventsView from "~/pages/Landing/components/EventsView";
import NewsListView from "~/pages/Landing/components/NewsListView";
import { ArrowRightIcon, ArrowUpRightFromSquareIcon } from "lucide-react";
import { Suspense, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";

import Wave from "./components/Wave";

export const Route = createFileRoute("/_MainLayout/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div>
      <Wave />
      <div className="bg-[#f2f2f2] dark:bg-[#071a2d]">
        <div className="max-w-5xl w-full mx-auto py-4 space-y-8 px-4">
          <ClientOnly>
            <NewStudentBox />
            <InfoBanner />
          </ClientOnly>
          <StoriesView />
        </div>
      </div>
      <div className="max-w-5xl w-full mx-auto py-4 space-y-6 px-4">
        <div className="flex items-center justify-center space-x-2">
          <h1 className="text-3xl font-bold">Arrangementer</h1>
          <Button asChild className="text-black dark:text-white" size="icon" variant="ghost">
            <Link to="/arrangementer">
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          </Button>
        </div>
        <ClientOnly>
          <EventsView />
        </ClientOnly>
      </div>
      <div className="bg-[#f2f2f2] dark:bg-[#071a2d]">
        <div className="max-w-5xl w-full mx-auto py-4 space-y-6 px-4">
          <div className="flex items-center justify-center space-x-2">
            <h1 className="text-3xl font-bold">Nyheter</h1>
            <Button asChild className="text-black dark:text-white" size="icon" variant="ghost">
              <Link to="/nyheter">
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </Button>
          </div>
          <ClientOnly>
            <NewsListView />
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}

function NewStudentBox() {
  const { auth } = useOptionalAuth();
  const isAuthenticated = useIsAuthenticated();

  const [shouldShowBox, setShouldShowBox] = usePersistedState("ShowNewStudentBox", true, 1000 * 3600 * 24 * 60);

  const HEADER = {
    NEW_STUDENT: "Nye studenter",
    OLD_STUDENT: "Velkommen tilbake",
    NO_AUTH: "Nye studenter",
  };

  const TEXT = useMemo(
    () => ({
      NEW_STUDENT: `Hei, ${auth?.user.name} 👋 Velkommen som ny student i TIHLDE! Vi gleder oss til å bli kjent med deg og håper at du vil være med på fadderuka og engasjere deg i linjeforeningen. Les alt på siden for nye studenter ⬇️`,
      OLD_STUDENT: `Hei, ${auth?.user.name} 👋 Velkommen tilbake til et nytt semester! Håper du har hatt en strålende sommer og er gira på å komme i gang igjen. Husk at det er lurt å sjekke nettsiden jevnlig for nye kule arrangementer og stillingsannonser 😃`,
      NO_AUTH:
        "Velkommen til alle nye studenter i TIHLDE 👋 Vi gleder oss til å bli kjent med dere og håper at dere vil være med på fadderuka og engasjere dere i linjeforeningen. Les alt om fadderuka, verv og FAQ på siden for nye studenter ⬇️",
    }),
    [auth?.user.name],
  );

  const studentState = useMemo<"NO_AUTH" | "OLD_STUDENT" | "NEW_STUDENT">(() => {
    if (auth == null) {
      return "NO_AUTH";
    }

    return "OLD_STUDENT";
  }, [auth]);

  function hideBox() {
    setShouldShowBox(false);
    analyticsEvent("hide-box", "new-student", "Hide new student box on landing page");
  }

  if (!shouldShowBox) return null;
  if (!SHOW_NEW_STUDENT_INFO) return null;

  return (
    <div className="p-4 rounded-md border max-w-3xl w-full mx-auto space-y-4">
      <h1 className="text-center text-4xl font-bold">{HEADER[studentState]}</h1>
      <p className="text-center">{TEXT[studentState]}</p>
      {studentState === "NEW_STUDENT" && (
        <div className="space-y-2 md:space-y-0 md:flex md:items-center md:space-x-4 md:justify-center pt-4 pb-2">
          <Button asChild className="w-full">
            <Link to="/ny-student">
              Nye studenter
              <ArrowRightIcon className="ml-2 w-5 h-5 stroke-[1.5px]" />
            </Link>
          </Button>
          {SHOW_FADDERUKA_INFO && (
            <Button asChild className="w-full" variant="outline">
              <a
                href="https://forms.gle/oJa8sQrkQfGq6vcNA"
                onClick={() => analyticsEvent("signup-fadderuka-from-box", "new-student", "Clicked on link to signup for fadderuka")}
                rel="noopener noreferrer"
                target="_blank"
              >
                Meld deg på fadderuka
                <ArrowUpRightFromSquareIcon className="ml-2 w-5 h-5 stroke-[1.5px]" />
              </a>
            </Button>
          )}
        </div>
      )}
      {isAuthenticated && (
        <Button className="w-full" onClick={hideBox} variant="outline">
          Ikke vis igjen
        </Button>
      )}
    </div>
  );
}

function StoriesView() {
  return (
    <ErrorBoundary fallback={<StoryLoading />}>
      <Suspense fallback={<StoryLoading />}>
        <Stories />
      </Suspense>
    </ErrorBoundary>
  );
}

const STORIES_TO_DISPLAY = 10;

type StoryItem = {
  id: string;
  type: "event" | "jobpost" | "news";
  title: string;
  image?: string;
  link: LinkOptions;
};

function Stories() {
  const { data: news } = useSuspenseQuery(listNewsQuery(0));
  const { data: jobPosts } = useSuspenseQuery(listJobsQuery(0));
  const { data: events } = useSuspenseQuery(listEventsQuery(0));

  const storyItems = useMemo<StoryItem[]>(() => {
    const items = [...news, ...jobPosts, ...events];
    items.sort((a, b) => b.date?.localeCompare(a.date ?? ""));

    return items.slice(0, STORIES_TO_DISPLAY);
  }, []);

  const SHORT_NAME = {
    event: "Arr.",
    jobpost: "Ann.",
    news: "Nyh.",
  };

  return (
    <ScrollArea className="w-full py-2">
      <div className="flex w-max space-x-2">
        {storyItems.map((item) => (
          <div key={item.id} className="space-y-2 max-w-[110px] w-full">
            <Link {...item.link} className="relative block">
              <AspectRatioImg alt={item.title} src={item.image} />
              <div className="absolute bottom-0.5 left-0.5 p-1 rounded-sm bg-card bg-opacity-70">
                <p className="text-[8px]">{SHORT_NAME[item.type]}</p>
              </div>
            </Link>

            <p className="text-sm text-center w-full whitespace-nowrap overflow-hidden text-ellipsis">{item.title}</p>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function StoryLoading() {
  return (
    <ScrollArea className="w-full">
      <div className="flex w-max space-x-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <div className="space-y-2 w-[110px]" key={index}>
            <Skeleton className="h-12" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
