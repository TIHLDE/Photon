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
        // På mobil er tekstkolonnen `contents`, så tittelen står ved siden av
        // avataren og resten får hver sin hele linje under. Fra md står
        // knappene til høyre, men får aldri mer enn halve bredden: som en
        // `auto`-kolonne i et grid tok de all plassen de ville ha, og tittelen
        // ble presset ned til én bokstav per linje.
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3 md:flex-nowrap">
            {avatar}
            <div className="contents md:flex md:min-w-0 md:flex-1 md:flex-col md:gap-3">
                {/* Lange, ubrytelige gruppenavn (Forvaltningsgruppen) må kunne
                    brytes, ellers presser de headeren ut av skjermen på mobil. */}
                <div className="min-w-0 flex-1 wrap-anywhere md:flex-none">
                    {title}
                </div>
                {subtitle ? (
                    <div className="w-full min-w-0">{subtitle}</div>
                ) : null}
                {badges ? (
                    <div className="flex w-full flex-wrap items-center gap-2">
                        {badges}
                    </div>
                ) : null}
            </div>
            {actions ? (
                <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:max-w-1/2 md:shrink-0 md:justify-end">
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
