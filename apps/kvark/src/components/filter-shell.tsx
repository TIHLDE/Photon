import { Button } from "@tihlde/ui/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@tihlde/ui/ui/drawer";
import { FilterX, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { FilterPillRow, type FilterPill } from "#/components/filter-pill-row";

type FilterShellProps = {
    searchSlot: ReactNode;
    fieldsSlot: ReactNode;
    pills: FilterPill[];
    onClearAll: () => void;
};

export function FilterShell({
    searchSlot,
    fieldsSlot,
    pills,
    onClearAll,
}: FilterShellProps) {
    return (
        <>
            <div className="flex flex-col gap-3 md:hidden">
                <div className="flex gap-2">
                    {searchSlot}
                    <Drawer>
                        <DrawerTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="Filter"
                            >
                                <SlidersHorizontal />
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent>
                            <DrawerHeader>
                                <DrawerTitle>Filter</DrawerTitle>
                            </DrawerHeader>
                            <div className="flex flex-col gap-4 px-4 pb-6">
                                {fieldsSlot}
                                {/* Filters apply as they change; this only closes the drawer. */}
                                <DrawerClose asChild>
                                    <Button>Ferdig</Button>
                                </DrawerClose>
                            </div>
                        </DrawerContent>
                    </Drawer>
                </div>
                <FilterPillRow pills={pills} onClearAll={onClearAll} />
            </div>

            <Card className="hidden md:block">
                <CardHeader className="min-h-12 pb-4">
                    <CardTitle>Filter</CardTitle>
                    {pills.length > 0 && (
                        <CardAction>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Fjern alle filtre"
                                onClick={onClearAll}
                            >
                                <FilterX />
                            </Button>
                        </CardAction>
                    )}
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {searchSlot}
                    {fieldsSlot}
                </CardContent>
            </Card>
        </>
    );
}
