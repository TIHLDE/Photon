import { Link } from "@tanstack/react-router";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Check, Trash2 } from "lucide-react";

export type NotificationItemProps = {
    title: string;
    description: string;
    /** Ferdig formatert tidspunkt, f.eks. "3 timer siden". */
    timeLabel: string;
    isRead: boolean;
    /** Normalisert lenke varselet peker til, om det har en. */
    href?: string;
    isExternal?: boolean;
    /** Kalles når varselet åpnes — brukes til å markere det som lest. */
    onOpen?: () => void;
    onMarkRead?: () => void;
    onDelete?: () => void;
    isBusy?: boolean;
};

/**
 * Én rad i varsellisten. Hele teksten er klikkbar når varselet har en lenke,
 * mens knappene til høyre står utenfor lenken så de ikke navigerer bort.
 */
export function NotificationItem({
    title,
    description,
    timeLabel,
    isRead,
    href,
    isExternal = false,
    onOpen,
    onMarkRead,
    onDelete,
    isBusy = false,
}: NotificationItemProps) {
    const body = (
        <div className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
                <span className="flex-1 text-sm">{title}</span>
                {isRead ? null : <Badge>Ny</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
            <span className="text-xs text-muted-foreground">{timeLabel}</span>
        </div>
    );

    return (
        <div className="flex items-start gap-1 p-2">
            {href && isExternal ? (
                <a
                    href={href}
                    onClick={onOpen}
                    className="flex-1"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {body}
                </a>
            ) : href ? (
                <Link to={href} onClick={onOpen} className="flex-1">
                    {body}
                </Link>
            ) : (
                <div className="flex-1">{body}</div>
            )}

            <div className="flex flex-col gap-1">
                {isRead ? null : (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Marker som lest"
                        disabled={isBusy}
                        onClick={onMarkRead}
                    >
                        <Check />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Slett varsel"
                    disabled={isBusy}
                    onClick={onDelete}
                >
                    <Trash2 />
                </Button>
            </div>
        </div>
    );
}
