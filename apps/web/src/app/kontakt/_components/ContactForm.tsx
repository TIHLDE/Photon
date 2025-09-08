"use client"

import React, {useMemo} from "react"
import {Button} from "@/components/ui/button"
import {Card} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import MultiCheckbox from "@/components/ui/MultiCheckbox"
import {Label} from "@/components/ui/label"
import {Textarea} from "@/components/ui/textarea"
import {addMonths} from 'date-fns';
import {CompaniesEmail} from "@/types/CompaniesEmail";
import * as z from 'zod';
import {useForm} from '@tanstack/react-form';
import type { AnyFieldApi } from '@tanstack/react-form'
import {toast} from "sonner";
import {LoaderCircle} from "lucide-react";
import {useCompanyContact} from "@/hooks/useCompanyContact";

function FieldInfo({ field }: { field: AnyFieldApi }) {
    return (
        <>
            {field.state.meta.isTouched && !field.state.meta.isValid ? (
                <em className="text-sm font-medium text-red-500">{field.state.meta.errors.map((err) => err.message).join(',')}</em>
            ) : null}
            {field.state.meta.isValidating ? 'Validating...' : null}
        </>
    )
}

const formSchema = z.object({
    bedrift: z.string().min(1, {message: 'Feltet er påkrevd'}),
    kontaktperson: z.string().min(1, {message: 'Feltet er påkrevd'}),
    epost: z.string().email({message: 'Ugyldig e-post'}),
    phone: z.string().regex(/^\+?\d{1,4}\s?(\d\s?){1,14}$/, 'Ugyldig telefonnummer'),
    time: z.array(z.string()).min(1, {message: 'Du må velge minst ett semester'}),
    type: z.array(z.string()).min(1, {message: 'Du må velge minst en type arrangement'}),
    comment: z.string(),
});

export default function ContactForm() {
    const { sendContact } = useCompanyContact();

    const form = useForm({
        defaultValues: {
            bedrift: '',
            kontaktperson: '',
            epost: '',
            phone: '',
            time: [] as string[],
            type: [] as string[],
            comment: '',
        },
        validators: {
            onSubmit: formSchema,
        },
        onSubmit: async ({value}) => {
            try {
                const payload: CompaniesEmail = {
                    info: {
                        bedrift: value.bedrift,
                        kontaktperson: value.kontaktperson,
                        epost: value.epost,
                        telefon: value.phone,
                    },
                    time: value.time,
                    type: value.type,
                    comment: value.comment ?? '',
                };

                console.log(payload);

                const response = await sendContact(payload);
                if (response.success) {
                    toast.success("Skjemaet ble sendt!");
                    form.reset();
                } else {
                    toast.error(response.message);
                }
            } catch (err: any) {
                toast.error(err.detail);
            }
        },
    });

    const getSemester = (semester: number) => {
        const date = addMonths(new Date(), 1);
        let dateMonth = date.getMonth() + semester * 6;
        let dateYear = date.getFullYear();
        while (dateMonth > 11) {
            dateMonth -= 12;
            dateYear++;
        }
        const returnMonth = dateMonth > 5 ? 'Høst' : 'Vår';
        return `${returnMonth} ${dateYear}`;
    };

    const semesters = useMemo(() => [...Array(4).keys()].map(getSemester), []);

    const types = [
        'Bedriftspresentasjon',
        'Kurs/Workshop',
        'Bedriftsbesøk',
        'Annonse',
        'Insta-takeover',
        'Bedriftsekskursjon',
        'Annet',
    ];

    return (
        <Card className="border-0 overflow-hidden bg-slate-800/50">
            <div className="px-6 pt-8">
                <h2 className="text-2xl font-bold">Ta kontakt med oss</h2>
                <p className="text-sm text-slate-300">Fyll ut kontaktskjemaet, så hører du fra oss straks.</p>
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation()
                    form.handleSubmit();
                }}
                className="space-y-6 py-6"
            >
                <div className="grid gap-6 md:grid-cols-2 px-6">
                    <div className="space-y-2 flex flex-col">
                        <form.Field
                            name="bedrift"
                            children={(field) => {
                                return (
                                    <>
                                        <Label htmlFor={field.name} className="text-sm font-medium">
                                            Bedrift <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id={field.name}
                                            placeholder="Firmanavn"
                                            className="bg-slate-900 border-0 text-white placeholder:text-slate-500"
                                            value={field.state.value || ''}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                        />

                                        <FieldInfo field={field} />
                                    </>
                                )
                            }}
                        />
                    </div>

                    <div className="space-y-2 flex flex-col">
                        <form.Field
                            name="kontaktperson"
                            children={(field) => {
                                return (
                                    <>
                                        <Label htmlFor={field.name} className="text-sm font-medium">
                                            Kontaktperson <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id={field.name}
                                            placeholder="Ola Nordmanne"
                                            className="bg-slate-900 border-0 text-white placeholder:text-slate-500"
                                            value={field.state.value || ''}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                        />

                                        <FieldInfo field={field} />
                                    </>
                                )
                            }}
                        />
                    </div>

                    <div className="space-y-2 flex flex-col">
                        <form.Field
                            name="epost"
                            children={(field) => {
                                return (
                                    <>
                                        <Label htmlFor={field.name} className="text-sm font-medium">
                                            Mail <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id={field.name}
                                            placeholder="eksempel@mail.com"
                                            className="bg-slate-900 border-0 text-white placeholder:text-slate-500"
                                            value={field.state.value || ''}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                        />

                                        <FieldInfo field={field} />
                                    </>
                                )
                            }}
                        />
                    </div>

                    <div className="space-y-2 flex flex-col">
                        <form.Field
                            name="phone"
                            children={(field) => {
                                return (
                                    <>
                                        <Label htmlFor={field.name} className="text-sm font-medium">
                                            Telefon
                                        </Label>
                                        <Input
                                            id={field.name}
                                            placeholder="+47 987 21 421"
                                            className="bg-slate-900 border-0 text-white placeholder:text-slate-500"
                                            value={field.state.value || ''}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                        />

                                        <FieldInfo field={field} />
                                    </>
                                )
                            }}
                        />
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 px-6">
                    <div className="space-y-4">
                        <form.Field
                            name="time"
                            mode="array"
                            children={(field) => {
                                return (
                                    <>
                                        <Label htmlFor={field.name} className="text-sm font-medium">
                                           Tidsramme <span className="text-red-500">*</span>
                                        </Label>
                                        <MultiCheckbox
                                            label="Semester"
                                            options={semesters}
                                            selected={field.state.value || []}
                                            onChange={(newVal) => field.handleChange(newVal)}
                                        />

                                        <FieldInfo field={field} />
                                    </>
                                )
                            }}
                        />
                    </div>

                    <div className="space-y-4">
                        <form.Field
                            name="type"
                            mode="array"
                            children={(field) => {
                                return (
                                    <>
                                        <Label htmlFor={field.name} className="text-sm font-medium">
                                            Interesser <span className="text-red-500">*</span>
                                        </Label>
                                        <MultiCheckbox
                                            label="Arrangementer"
                                            options={types}
                                            selected={field.state.value || []}
                                            onChange={(newVal) => field.handleChange(newVal)}
                                        />

                                        <FieldInfo field={field} />
                                    </>
                                )
                            }}
                        />
                    </div>
                </div>


                <div className="space-y-2 px-6">
                    <form.Field
                        name="comment"
                        children={(field) => {
                            return (
                                <>
                                    <Label htmlFor={field.name} className="text-sm font-medium">
                                       Melding
                                    </Label>
                                    <Textarea
                                        id={field.name}
                                        placeholder="Utfyllende beskrivelse"
                                        className="bg-slate-900 border-0 h-32 text-white placeholder:text-slate-500"
                                        value={field.state.value || ''}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                    />

                                    <FieldInfo field={field} />
                                </>
                            )
                        }}
                    />
                </div>

                <div className="px-6 pb-3">
                    <form.Subscribe
                        selector={(state) => [state.canSubmit, state.isSubmitting]}
                        children={([canSubmit, isSubmitting]) => (
                            <Button
                                type="submit"
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                                disabled={!canSubmit}
                            >
                                {isSubmitting ? (
                                    <>
                                    <p>Sender</p> <LoaderCircle className="animate-spin w-12 h-12 text-white" />
                                    </>
                                ) : ('Send inn')}
                            </Button>
                        )}
                    />
                </div>
            </form>
        </Card>
    );
}