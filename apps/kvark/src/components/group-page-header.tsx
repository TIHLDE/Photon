import type { ReactNode } from "react";
import { Text } from "@tihlde/ui/ui/text";

type GroupPageHeaderProps = {
    title: string;
    action?: ReactNode;
};

export function GroupPageHeader({ title, action }: GroupPageHeaderProps) {
    return (
        // Wrapper på smale skjermer: uten det krymper tittelen til den
        // brekker midt i ordet for å gi plass til handlingsknappene.
        <div className="flex flex-wrap items-center justify-between gap-3">
            <Text render={<h2 />} size="2xl">
                {title}
            </Text>
            {action}
        </div>
    );
}
