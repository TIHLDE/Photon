import { Button } from "@tihlde/ui/ui/button";
import { Separator } from "@tihlde/ui/ui/separator";
import { Fragment, type ReactNode } from "react";

type NavItem<K extends string> = {
    key: K;
    label: string;
    icon?: ReactNode;
};

type DetailLayoutProps = {
    header: ReactNode;
    children: ReactNode;
};

export function DetailLayout({ header, children }: DetailLayoutProps) {
    return (
        <div className="container mx-auto flex w-full flex-col gap-6 px-4 py-8">
            {header}
            <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
                {children}
            </div>
        </div>
    );
}

type DetailHeaderProps = {
    avatar: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    badges?: ReactNode;
    actions?: ReactNode;
};

export function DetailHeader({
    avatar,
    title,
    subtitle,
    badges,
    actions,
}: DetailHeaderProps) {
    return (
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 gap-y-3 md:grid-cols-[auto_1fr_auto] md:items-stretch">
            {avatar}
            <div className="min-w-0">{title}</div>
            {subtitle ? (
                <div className="col-span-2 min-w-0 md:col-span-1 md:col-start-2">
                    {subtitle}
                </div>
            ) : null}
            {badges ? (
                <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:col-start-2">
                    {badges}
                </div>
            ) : null}
            {actions ? (
                <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:col-start-3 md:row-start-1 md:justify-end">
                    {actions}
                </div>
            ) : null}
        </div>
    );
}

type DetailLayoutNavProps<K extends string> = {
    sections: NavItem<K>[][];
    active: K;
    onSelect: (key: K) => void;
    desktopFooter?: ReactNode;
};

export function DetailLayoutNav<K extends string>({
    sections,
    active,
    onSelect,
    desktopFooter,
}: DetailLayoutNavProps<K>) {
    const flatItems = sections.flat();

    return (
        <>
            <nav className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                <ul className="flex w-max gap-2">
                    {flatItems.map((item) => (
                        <li key={item.key} className="shrink-0">
                            <Button
                                variant={
                                    active === item.key ? "default" : "ghost"
                                }
                                size="sm"
                                onClick={() => onSelect(item.key)}
                            >
                                {item.icon}
                                {item.label}
                            </Button>
                        </li>
                    ))}
                </ul>
            </nav>

            <aside className="hidden md:block">
                <nav className="flex flex-col gap-2">
                    {sections.map((items, index) => (
                        <Fragment key={index}>
                            {index > 0 ? <Separator className="my-2" /> : null}
                            <ul className="flex flex-col gap-1">
                                {items.map((item) => (
                                    <li key={item.key}>
                                        <Button
                                            variant={
                                                active === item.key
                                                    ? "default"
                                                    : "ghost"
                                            }
                                            className="w-full justify-start"
                                            onClick={() => onSelect(item.key)}
                                        >
                                            {item.icon}
                                            <span className="flex-1 text-left">
                                                {item.label}
                                            </span>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </Fragment>
                    ))}
                    {desktopFooter ? (
                        <>
                            <Separator className="my-2" />
                            {desktopFooter}
                        </>
                    ) : null}
                </nav>
            </aside>
        </>
    );
}

export function DetailLayoutContent({ children }: { children: ReactNode }) {
    return (
        <section className="flex min-w-0 flex-col gap-6">{children}</section>
    );
}
