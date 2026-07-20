import { Badge } from "@tihlde/ui/ui/badge";
import { Bell } from "lucide-react";

type ProfileOverviewHeaderProps = {
    name: string;
    notifications?: number;
};

export function ProfileOverviewHeader({
    name,
    notifications = 0,
}: ProfileOverviewHeaderProps) {
    const firstName = name.split(" ")[0] ?? name;

    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl">Oversikt</h2>
                <p className="text-sm text-muted-foreground">
                    Velkommen tilbake, {firstName}
                </p>
            </div>
            <Badge variant="outline" className="gap-1.5">
                <Bell />
                {notifications} nye varsler
            </Badge>
        </div>
    );
}
