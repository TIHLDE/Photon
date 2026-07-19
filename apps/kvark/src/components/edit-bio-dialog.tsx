import { useForm } from "@tanstack/react-form";
import { Button } from "@tihlde/ui/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@tihlde/ui/ui/dialog";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@tihlde/ui/ui/field";
import { Input } from "@tihlde/ui/ui/input";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

const BIO_MAX = 500;

const editBioSchema = z.object({
    bio: z.string().max(BIO_MAX, `Maks ${BIO_MAX} tegn`),
    github: z.string(),
    linkedin: z.string(),
});

type EditBioValues = z.infer<typeof editBioSchema>;

type EditBioDialogProps = {
    defaultValues?: Partial<EditBioValues>;
    onSubmit?: (values: EditBioValues) => void | Promise<void>;
};

export function EditBioDialog({ defaultValues, onSubmit }: EditBioDialogProps) {
    const [open, setOpen] = useState(false);

    const form = useForm({
        defaultValues: {
            bio: defaultValues?.bio ?? "",
            github: defaultValues?.github ?? "",
            linkedin: defaultValues?.linkedin ?? "",
        } satisfies EditBioValues,
        validators: { onChange: editBioSchema },
        onSubmit: async ({ value }) => {
            await onSubmit?.(value);
            setOpen(false);
        },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button>
                        <Pencil />
                        Rediger bio
                    </Button>
                }
            />
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Rediger bio</DialogTitle>
                    <DialogDescription>Rediger din bio</DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className="flex flex-col gap-4"
                >
                    <FieldGroup>
                        <form.Field name="bio">
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor={field.name}>
                                        Beskrivelse
                                    </FieldLabel>
                                    <Textarea
                                        id={field.name}
                                        name={field.name}
                                        rows={4}
                                        placeholder="Skriv her..."
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) =>
                                            field.handleChange(e.target.value)
                                        }
                                    />
                                    <FieldDescription>
                                        Tegn igjen:{" "}
                                        {Math.max(
                                            0,
                                            BIO_MAX -
                                                (field.state.value?.length ??
                                                    0),
                                        )}
                                    </FieldDescription>
                                    <FieldError
                                        errors={field.state.meta.errors}
                                    />
                                </Field>
                            )}
                        </form.Field>

                        <form.Field name="github">
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor={field.name}>
                                        GitHub
                                    </FieldLabel>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        placeholder="Skriv her..."
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) =>
                                            field.handleChange(e.target.value)
                                        }
                                    />
                                    <FieldDescription>
                                        Din GitHub profil.
                                    </FieldDescription>
                                    <FieldError
                                        errors={field.state.meta.errors}
                                    />
                                </Field>
                            )}
                        </form.Field>

                        <form.Field name="linkedin">
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor={field.name}>
                                        LinkedIn
                                    </FieldLabel>
                                    <Input
                                        id={field.name}
                                        name={field.name}
                                        placeholder="Skriv her..."
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(e) =>
                                            field.handleChange(e.target.value)
                                        }
                                    />
                                    <FieldDescription>
                                        Din LinkedIn profil.
                                    </FieldDescription>
                                    <FieldError
                                        errors={field.state.meta.errors}
                                    />
                                </Field>
                            )}
                        </form.Field>
                    </FieldGroup>

                    <DialogFooter>
                        <form.Subscribe
                            selector={(state) => ({
                                canSubmit: state.canSubmit,
                                isSubmitting: state.isSubmitting,
                            })}
                        >
                            {({ canSubmit, isSubmitting }) => (
                                <Button type="submit" disabled={!canSubmit}>
                                    {isSubmitting ? "Lagrer..." : "Opprett"}
                                </Button>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
