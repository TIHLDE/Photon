import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Checkbox } from "@tihlde/ui/ui/checkbox";
import { Input } from "@tihlde/ui/ui/input";
import { Label } from "@tihlde/ui/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@tihlde/ui/ui/select";
import { Search } from "lucide-react";

export type Category = { value: string; label: string };

export type EventFiltersValue = {
    query: string;
    category: string;
    showPast: boolean;
    openRegistration: boolean;
};

type EventFiltersProps = {
    value: EventFiltersValue;
    categories: Category[];
    onChange: (next: EventFiltersValue) => void;
    onSubmit: () => void;
};

export function EventFilters({
    value,
    categories,
    onChange,
    onSubmit,
}: EventFiltersProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Filter</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="event-search">Søk</Label>
                    <Input
                        id="event-search"
                        placeholder="Søk etter arrangement"
                        value={value.query}
                        onChange={(e) =>
                            onChange({ ...value, query: e.target.value })
                        }
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <Label>Kategori</Label>
                    <Select
                        value={value.category}
                        onValueChange={(category) =>
                            onChange({ ...value, category: category ?? "" })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Velg kategori" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                    {c.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-3">
                    <span className="text-sm">Alternativ</span>
                    <Label className="justify-between">
                        <span className="flex flex-col">
                            <span>Tidligere</span>
                            <span className="text-muted-foreground">
                                Vis tidligere arrangementer
                            </span>
                        </span>
                        <Checkbox
                            checked={value.showPast}
                            onCheckedChange={(checked) =>
                                onChange({
                                    ...value,
                                    showPast: checked === true,
                                })
                            }
                        />
                    </Label>
                    <Label className="justify-between">
                        <span className="flex flex-col">
                            <span>Åpen påmelding</span>
                            <span className="text-muted-foreground">
                                Vis kun arrangementer med åpen påmelding
                            </span>
                        </span>
                        <Checkbox
                            checked={value.openRegistration}
                            onCheckedChange={(checked) =>
                                onChange({
                                    ...value,
                                    openRegistration: checked === true,
                                })
                            }
                        />
                    </Label>
                </div>

                <Button onClick={onSubmit} className="w-full">
                    <Search />
                    Søk
                </Button>
            </CardContent>
        </Card>
    );
}
