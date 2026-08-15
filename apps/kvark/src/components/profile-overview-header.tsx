type ProfileOverviewHeaderProps = {
    name: string;
    /** Velkomsthilsen gir bare mening på ens egen profil. */
    isOwnProfile?: boolean;
};

export function ProfileOverviewHeader({
    name,
    isOwnProfile = true,
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
        </div>
    );
}
