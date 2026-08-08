import { avatarImageUrl } from "#/lib/assets";

type DetailIdentityProps = {
    name: string;
    logoUrl?: string;
};

export function DetailIdentity({ name, logoUrl }: DetailIdentityProps) {
    return (
        // `truncate` på navnet virker bare hvis raden selv får krympe —
        // uten `min-w-0` setter et langt gruppenavn bredden på hele headeren.
        <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
                <img
                    alt={name}
                    src={avatarImageUrl(logoUrl)}
                    loading="lazy"
                    decoding="async"
                    className="size-12 shrink-0 rounded-lg object-cover"
                />
            ) : null}
            <span className="truncate font-medium">{name}</span>
        </div>
    );
}
