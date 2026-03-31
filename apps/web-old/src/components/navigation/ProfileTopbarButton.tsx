import { Link, linkOptions, useLocation } from "@tanstack/react-router";
import ThemeSettings from "~/components/miscellaneous/ThemeSettings";
import TopbarNotifications from "~/components/navigation/TopbarNotifications";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useOptionalAuth } from "~/hooks/auth";
import { Bug, UserRoundIcon } from "lucide-react";

const ProfileTopbarButton = () => {
  const { auth } = useOptionalAuth();
  const location = useLocation();

  // TODO: Add analytics back
  // const { event } = useAnalytics();
  // const analytics = (page: string) => event(`go-to-${page}`, 'topbar-profile-button', `Go to ${page}`);

  return (
    <div className="flex items-center space-x-4">
      {Boolean(auth) && (
        <>
          <TopbarNotifications />
          <Link className="bug-button" to="/tilbakemelding">
            <Bug className="dark:text-white w-[1.2rem] h-[1.2rem] stroke-[2px]" />
          </Link>
        </>
      )}
      <ThemeSettings />
      {auth?.user ? (
        <Link to="/profil/{-$userId}">
          <Avatar>
            <AvatarImage alt={auth.user.name} src={auth.user.image ?? ""} />
            <AvatarFallback>
              {auth.user.name
                .split(/\s+/)
                .map((n) => n.charAt(0))
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
      ) : (
        <Link
          {...linkOptions({
            to: "/logg-inn",
            search: {
              redirectTo: location.pathname,
            },
          })}
        >
          <UserRoundIcon className="dark:text-white w-[1.2rem] h-[1.2rem] stroke-[1.5px]" />
        </Link>
      )}
    </div>
  );
};

export default ProfileTopbarButton;
