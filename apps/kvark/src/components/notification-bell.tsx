import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from "@tihlde/ui/ui/popover";
import { Separator } from "@tihlde/ui/ui/separator";
import { Skeleton } from "@tihlde/ui/ui/skeleton";
import { Bell } from "lucide-react";
import { useState } from "react";

import {
    deleteNotificationMutation,
    getNotificationsInfiniteQuery,
    getUnreadNotificationCountQuery,
    markNotificationReadMutation,
} from "#/api/queries/notifications";
import { LoadMoreButton } from "#/components/load-more-button";
import { NotificationItem } from "#/components/notification-item";
import {
    formatNotificationTime,
    isExternalNotificationHref,
    notificationHref,
} from "#/lib/notification";

/** Færre enn listesiden bruker — popoveren er smal og scroller. */
const PAGE_SIZE = 10;

/**
 * Bjella i headeren. Teller uleste varsler hele tiden, men henter selve listen
 * først når popoveren åpnes — de fleste sidevisningene åpner den aldri.
 */
export function NotificationBell() {
    const [open, setOpen] = useState(false);

    const { data: unreadCount = 0 } = useQuery(
        getUnreadNotificationCountQuery(),
    );

    const { data, isPending, hasNextPage, fetchNextPage, isFetchingNextPage } =
        useInfiniteQuery({
            ...getNotificationsInfiniteQuery({}, PAGE_SIZE),
            enabled: open,
        });

    const markRead = useMutation(markNotificationReadMutation);
    const remove = useMutation(deleteNotificationMutation);

    const notifications = data?.pages.flatMap((page) => page.items) ?? [];

    const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);
    const triggerLabel =
        unreadCount === 0
            ? "Varsler"
            : unreadCount === 1
              ? "Varsler, 1 ulest"
              : `Varsler, ${unreadCount} uleste`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={triggerLabel}
                        className="relative"
                    />
                }
            >
                <Bell />
                {unreadCount > 0 ? (
                    <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1">
                        {badgeLabel}
                    </Badge>
                ) : null}
            </PopoverTrigger>

            <PopoverContent
                align="end"
                className="w-80 gap-0 p-0 sm:w-96"
                aria-label="Varsler"
            >
                <PopoverHeader className="flex-row items-center justify-between gap-2 p-3">
                    <PopoverTitle>Varsler</PopoverTitle>
                    {unreadCount > 0 ? (
                        <span className="text-xs text-muted-foreground">
                            {unreadCount === 1
                                ? "1 ulest"
                                : `${unreadCount} uleste`}
                        </span>
                    ) : null}
                </PopoverHeader>
                <Separator />

                {isPending ? (
                    <div className="flex flex-col gap-2 p-3">
                        {[0, 1, 2].map((row) => (
                            <Skeleton key={row} className="h-14 w-full" />
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                        Du har ingen varsler.
                    </p>
                ) : (
                    /* ScrollArea fra @tihlde/ui trenger en fast høyde for å
                       scrolle. Her vokser lista til den treffer max-h, så en
                       vanlig overflow-container er det som faktisk virker. */
                    <div className="max-h-96 overflow-y-auto">
                        <ul className="flex flex-col p-1">
                            {notifications.map((notification) => {
                                const href = notificationHref(
                                    notification.link,
                                );
                                const isBusy =
                                    (markRead.isPending &&
                                        markRead.variables?.notificationId ===
                                            notification.id) ||
                                    (remove.isPending &&
                                        remove.variables?.notificationId ===
                                            notification.id);

                                return (
                                    <li key={notification.id}>
                                        <NotificationItem
                                            title={notification.title}
                                            description={
                                                notification.description
                                            }
                                            timeLabel={formatNotificationTime(
                                                notification.createdAt,
                                            )}
                                            isRead={notification.isRead}
                                            href={href}
                                            isExternal={isExternalNotificationHref(
                                                href,
                                            )}
                                            isBusy={isBusy}
                                            onOpen={() => {
                                                setOpen(false);
                                                if (!notification.isRead) {
                                                    markRead.mutate({
                                                        notificationId:
                                                            notification.id,
                                                    });
                                                }
                                            }}
                                            onMarkRead={() =>
                                                markRead.mutate({
                                                    notificationId:
                                                        notification.id,
                                                })
                                            }
                                            onDelete={() =>
                                                remove.mutate({
                                                    notificationId:
                                                        notification.id,
                                                })
                                            }
                                        />
                                    </li>
                                );
                            })}
                        </ul>

                        {hasNextPage ? (
                            <div className="flex justify-center p-2">
                                <LoadMoreButton
                                    onClick={() => fetchNextPage()}
                                    isLoading={isFetchingNextPage}
                                />
                            </div>
                        ) : null}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
