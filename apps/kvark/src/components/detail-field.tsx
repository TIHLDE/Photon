import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Text } from "@tihlde/ui/ui/text";

type DetailFieldProps = {
    icon?: LucideIcon;
    label?: ReactNode;
    value: ReactNode;
    action?: ReactNode;
};

export function DetailField({
    icon: Icon,
    label,
    value,
    action,
}: DetailFieldProps) {
    if (label) {
        return (
            // Verdien lå tidligere i en `shrink-0`-boks, så lange verdier
            // (kontaktpersoner, «Studenter ved …») presset raden ut av
            // skjermen på mobil. Begge sidene får krympe nå; bare ikonet og
            // handlingen holdes i full bredde.
            <Text
                render={<div />}
                size="sm"
                className="flex flex-col items-start justify-between gap-3"
            >
                <Text
                    render={<div />}
                    tone="muted"
                    className="flex min-w-0 items-center gap-2.5"
                >
                    {Icon ? <Icon className="size-4 shrink-0" /> : null}
                    <span className="truncate">{label}</span>
                </Text>
                <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 text-right wrap-anywhere">
                        {value}
                    </span>
                    {action ? <div className="shrink-0">{action}</div> : null}
                </div>
            </Text>
        );
    }

    return (
        <Text
            render={<div />}
            size="sm"
            className="flex items-start justify-between gap-3"
        >
            <div className="flex min-w-0 items-start gap-2.5">
                {Icon ? (
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : null}
                <span className="wrap-anywhere">{value}</span>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </Text>
    );
}
