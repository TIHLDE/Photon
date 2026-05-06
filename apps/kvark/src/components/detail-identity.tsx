type DetailIdentityProps = {
    name: string;
    logoUrl?: string;
};

export function DetailIdentity({ name, logoUrl }: DetailIdentityProps) {
    return (
        <div className="flex items-center gap-3">
            {logoUrl ? (
                <img
                    alt={name}
                    src={logoUrl}
                    className="size-12 shrink-0 rounded-lg object-cover"
                />
            ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-medium">
                    {name.slice(0, 2).toUpperCase()}
                </div>
            )}
            <span className="truncate font-medium">{name}</span>
        </div>
    );
}
