import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";

export type TriState = "all" | "yes" | "no";

type TriStateFilterProps = {
    value: TriState;
    onChange: (v: TriState) => void;
    options: Record<TriState, string>;
};

export function TriStateFilter({
    value,
    onChange,
    options,
}: TriStateFilterProps) {
    return (
        <Tabs value={value} onValueChange={(v) => onChange(v as TriState)}>
            <TabsList>
                <TabsTrigger value="all">{options.all}</TabsTrigger>
                <TabsTrigger value="yes">{options.yes}</TabsTrigger>
                <TabsTrigger value="no">{options.no}</TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
