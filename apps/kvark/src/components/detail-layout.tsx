import { ScrollFade } from "@tihlde/ui/ui/scroll-fade";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import type { ReactNode } from "react";

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
            {children}
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
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-stretch">
            {avatar}
            {/* Lange, ubrytelige gruppenavn (Forvaltningsgruppen) må kunne
                brytes, ellers presser de headeren ut av skjermen på mobil. */}
            <div className="min-w-0 wrap-anywhere">{title}</div>
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
};

export function DetailLayoutNav<K extends string>({
    sections,
    active,
    onSelect,
}: DetailLayoutNavProps<K>) {
    const flatItems = sections.flat();

    return (
        // Scrollboksen følger innholdsbredden (ingen full-bleed), så fanene
        // holder seg i linje med resten av siden. ScrollFade toner dem ut i den
        // kanten det finnes mer å scrolle til, i stedet for et hardt kutt.
        <ScrollFade render={<nav />}>
            <Tabs
                value={active}
                onValueChange={(value) => onSelect(value as K)}
            >
                <TabsList>
                    {flatItems.map((item) => (
                        <TabsTrigger
                            key={item.key}
                            value={item.key}
                            className="px-3"
                        >
                            {item.icon}
                            {item.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </ScrollFade>
    );
}

export function DetailLayoutContent({ children }: { children: ReactNode }) {
    return (
        <section className="flex min-w-0 flex-col gap-6">{children}</section>
    );
}
