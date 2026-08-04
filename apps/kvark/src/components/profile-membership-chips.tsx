import { Link } from "@tanstack/react-router";
import { Badge } from "@tihlde/ui/ui/badge";

export type MembershipChip = {
    slug: string;
    name: string;
    /**
     * Om den som ser på faktisk får åpne gruppesiden. Private grupper er bare
     * for medlemmene, så en chip uten tilgang rendres uten lenke i stedet for
     * å sende brukeren til en 403.
     */
    canOpen: boolean;
};

type ProfileMembershipChipsProps = {
    groups: MembershipChip[];
};

/** Gruppene en bruker er medlem i, som chips på profiloversikten. */
export function ProfileMembershipChips({
    groups,
}: ProfileMembershipChipsProps) {
    return (
        <ul className="flex flex-wrap gap-2">
            {groups.map((group) => (
                <li key={group.slug}>
                    {group.canOpen ? (
                        <Badge
                            variant="secondary"
                            render={
                                <Link
                                    to="/grupper/$slug"
                                    params={{ slug: group.slug }}
                                />
                            }
                        >
                            {group.name}
                        </Badge>
                    ) : (
                        <Badge variant="outline">{group.name}</Badge>
                    )}
                </li>
            ))}
        </ul>
    );
}
