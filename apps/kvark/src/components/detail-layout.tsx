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
};

export function DetailLayoutNav<K extends string>({
    sections,
    active,
    onSelect,
}: DetailLayoutNavProps<K>) {
    const flatItems = sections.flat();

    return (
        <nav className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        </nav>
    );
}

export function DetailLayoutContent({ children }: { children: ReactNode }) {
    return (
        <section className="flex min-w-0 flex-col gap-6">{children}</section>
    );
}
