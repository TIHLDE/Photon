import { Badge } from "@tihlde/ui/ui/badge";
import { Bell } from "lucide-react";

type ProfileOverviewHeaderProps = {
    name: string;
    /** Velkomsthilsen og varsler gir bare mening på ens egen profil. */
    isOwnProfile?: boolean;
    notifications?: number;
};

export function ProfileOverviewHeader({
    name,
    isOwnProfile = true,
    notifications = 0,
}: ProfileOverviewHeaderProps) {
    const firstName = name.split(" ")[0] ?? name;

    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl">Oversikt</h2>
                {isOwnProfile ? (
                    <p className="text-sm text-muted-foreground">
                        Velkommen tilbake, {firstName}
                    </p>
                ) : null}
            </div>
            {isOwnProfile ? (
                <Badge variant="outline" className="gap-1.5">
                    <Bell />
                    {notifications === 1
                        ? "1 nytt varsel"
                        : `${notifications} nye varsler`}
                </Badge>
            ) : null}
        </div>
    );
}
