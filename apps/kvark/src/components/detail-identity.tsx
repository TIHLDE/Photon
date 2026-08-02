import { avatarImageUrl } from "#/lib/assets";

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
