import { formHandlers, useAppForm } from "#/hooks/form";
import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { FieldGroup } from "@tihlde/ui/ui/field";
import { InputGroupAddon, InputGroupButton } from "@tihlde/ui/ui/input-group";
import { SearchIcon } from "lucide-react";

const CLASS_LEVELS = [
    { value: 1, label: "1. klasse" },
    { value: 2, label: "2. klasse" },
    { value: 3, label: "3. klasse" },
    { value: 4, label: "4. klasse" },
    { value: 5, label: "5. klasse" },
];

const JOB_TYPES = [
    { value: "alle", label: "Alle" },
    { value: "sommerjobb", label: "Sommerjobb" },
    { value: "deltid", label: "Deltid" },
    { value: "fulltid", label: "Fulltid" },
    { value: "annet", label: "Annet" },
];

type JobType = "alle" | "sommerjobb" | "deltid" | "fulltid" | "annet";

export function JobFiltersDemo() {
    const form = useAppForm({
        defaultValues: {
            query: "",
            classLevels: [] as number[],
            jobType: "alle" as JobType,
        },
        async onSubmit({ value }) {
            globalThis.console.log("Filter:", value);
        },
    });

    return (
        <Card data-size="sm" className="self-start">
            <CardHeader>
                <CardTitle>Filter</CardTitle>
            </CardHeader>
            <CardContent>
                <form {...formHandlers(form)} className="flex flex-col gap-4">
                    <FieldGroup>
                        <form.AppField name="query">
                            {(field) => (
                                <field.Field>
                                    <field.Input placeholder="Søk etter tittel, firma...">
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupButton
                                                type="submit"
                                                size="icon-xs"
                                                aria-label="Søk"
                                            >
                                                <SearchIcon />
                                            </InputGroupButton>
                                        </InputGroupAddon>
                                    </field.Input>
                                </field.Field>
                            )}
                        </form.AppField>

                        <form.AppField name="classLevels">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Klassetrinn</field.Label>
                                    <field.CheckboxGroup
                                        options={CLASS_LEVELS}
                                    />
                                </field.Field>
                            )}
                        </form.AppField>

                        <form.AppField name="jobType">
                            {(field) => (
                                <field.Field>
                                    <field.Label>Jobbtype</field.Label>
                                    <field.RadioGroup options={JOB_TYPES} />
                                </field.Field>
                            )}
                        </form.AppField>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
