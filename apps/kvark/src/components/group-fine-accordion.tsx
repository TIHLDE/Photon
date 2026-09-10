import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@tihlde/ui/ui/alert-dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@tihlde/ui/ui/accordion";
import { Badge } from "@tihlde/ui/ui/badge";
import { Button } from "@tihlde/ui/ui/button";
import { Card, CardContent } from "@tihlde/ui/ui/card";
import { Label } from "@tihlde/ui/ui/label";
import { Textarea } from "@tihlde/ui/ui/textarea";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MarkdownView } from "@tihlde/ui/complex/markdown";

import { HandCoins, ShieldCheck } from "lucide-react";

import { minimalRegistry } from "#/components/markdown/directives/presets";
import { GroupFineRow } from "#/components/group-fine-row";
import { GalleryLightbox } from "#/components/gallery-lightbox";
import type { Fine } from "#/lib/group";

import { fetchFineImageUrl } from "#/api/queries/groups";

// Bøtebilder er private, så de må hentes med sesjonen framfor å pekes på med
// en `<img src>`. Bildekroken bor i panelet, som avmonteres når boten lukkes,
// så bildet hentes først når boten faktisk står åpen.
function useFineImage(groupSlug: string, fineId: string, hasImage: boolean) {
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setUrl(null);
        setFailed(false);

        if (!hasImage) return;

        let revoked = false;
        let objectUrl: string | null = null;

        fetchFineImageUrl(groupSlug, fineId)
            .then((next) => {
                objectUrl = next;
                if (revoked) {
                    URL.revokeObjectURL(next);
                    return;
                }
                setUrl(next);
            })
            .catch(() => {
                if (!revoked) setFailed(true);
            });

        return () => {
            revoked = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [groupSlug, fineId, hasImage]);

    return { url, failed };
}

type GroupFineDetailsProps = {
    groupSlug: string;
    fine: Fine;
    canManage: boolean;
    readOnly: boolean;
    currentUserId?: string;
    defenseDraft: string | null;
    onDefenseDraftChange: (draft: string | null) => void;
    onApprove: (fine: Fine) => void;
    onMarkPaid: (fine: Fine) => void;
    onDelete: (fine: Fine) => void;
    onSaveDefense: (fine: Fine, defense: string) => void;
};

function GroupFineDetails({
    groupSlug,
    fine,
    canManage,
    readOnly,
    currentUserId,
    defenseDraft,
    onDefenseDraftChange,
    onApprove,
    onMarkPaid,
    onDelete,
    onSaveDefense,
}: GroupFineDetailsProps) {
    const { url: imageUrl, failed: imageFailed } = useFineImage(
        groupSlug,
        fine.id,
        Boolean(fine.image),
    );

    const isOwnFine = Boolean(currentUserId && fine.userId === currentUserId);
    const canWriteDefense = isOwnFine && !readOnly;
    const defenseValue = defenseDraft ?? fine.defense;
    const defenseChanged =
        defenseDraft !== null && defenseDraft !== fine.defense;
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const text = (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                    Begrunnelse
                </span>
                <MarkdownView registry={minimalRegistry} source={fine.reason} />
            </div>
            {canWriteDefense ? (
                <div className="flex flex-col gap-2">
                    <Label htmlFor={`fine-defense-${fine.id}`}>
                        Ditt forsvar
                    </Label>
                    <Textarea
                        id={`fine-defense-${fine.id}`}
                        rows={3}
                        placeholder="Forklar din side av saken"
                        value={defenseValue}
                        onChange={(event) =>
                            onDefenseDraftChange(event.target.value)
                        }
                    />
                    <Button
                        size="sm"
                        className="self-start"
                        disabled={!defenseChanged}
                        onClick={() => {
                            onSaveDefense(fine, defenseValue);
                            onDefenseDraftChange(null);
                        }}
                    >
                        Lagre forsvar
                    </Button>
                </div>
            ) : fine.defense ? (
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                        Forsvar
                    </span>
                    <MarkdownView
                        registry={minimalRegistry}
                        source={fine.defense}
                    />
                </div>
            ) : null}
        </div>
    );

    return (
        <div className="flex flex-col gap-3 pb-1">
            <div className="flex flex-wrap gap-2">
                <Badge variant={fine.approved ? "default" : "destructive"}>
                    <ShieldCheck data-icon="inline-start" />
                    {fine.approved ? "Godkjent" : "Ikke godkjent"}
                </Badge>
                <Badge variant={fine.paid ? "default" : "destructive"}>
                    <HandCoins data-icon="inline-start" />
                    {fine.paid ? "Betalt" : "Ikke betalt"}
                </Badge>
            </div>
            <div className="text-sm">
                <p>Dato: {fine.date}</p>
                {fine.createdBy ? <p>Fra: {fine.createdBy}</p> : null}
            </div>
            {fine.image && imageFailed ? (
                <p className="text-sm text-muted-foreground">
                    Fikk ikke lastet bildet. Last siden på nytt.
                </p>
            ) : null}
            {fine.image && !imageFailed ? (
                imageUrl ? (
                    <div className="flex flex-col gap-3 md:flex-row md:gap-4">
                        <button
                            type="button"
                            className="w-full max-w-full cursor-zoom-in self-center rounded-md md:w-auto md:max-w-1/2 md:self-start"
                            onClick={() => setLightboxOpen(true)}
                            aria-label="Åpne bildet forstørret"
                        >
                            <img
                                src={imageUrl}
                                alt="Bevis for boten"
                                decoding="async"
                                className="block max-h-80 w-full rounded-md object-contain"
                            />
                        </button>
                        {text}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 md:flex-row md:gap-4">
                        <div className="h-40 w-full animate-pulse rounded-md bg-muted md:w-64" />
                        {text}
                    </div>
                )
            ) : (
                text
            )}
            {imageUrl ? (
                <GalleryLightbox
                    pictures={[
                        {
                            id: fine.id,
                            imageUrl,
                            imageAlt: "Bevis for boten",
                        },
                    ]}
                    openIndex={lightboxOpen ? 0 : null}
                    onOpenChange={(index) => setLightboxOpen(index !== null)}
                />
            ) : null}
            {canManage ? (
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant={fine.approved ? "outline" : "default"}
                        disabled={fine.approved}
                        onClick={() => onApprove(fine)}
                    >
                        Merk som godkjent
                    </Button>
                    <Button
                        size="sm"
                        variant={
                            !fine.approved || fine.paid ? "outline" : "default"
                        }
                        disabled={fine.paid}
                        onClick={() => onMarkPaid(fine)}
                    >
                        Merk som betalt
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        className="ml-auto"
                        onClick={() => onDelete(fine)}
                    >
                        <Trash2 />
                        Slett bot
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

type GroupFineAccordionProps = {
    groupSlug: string;
    fines: Fine[];
    /** Whether the viewer may approve, settle or delete the group's fines. */
    canManage: boolean;
    /** Satt for den som har forlatt gruppen: ingenting kan endres. */
    readOnly: boolean;
    currentUserId?: string;
    onApprove: (fine: Fine) => void;
    onMarkPaid: (fine: Fine) => void;
    onDelete: (fine: Fine) => void;
    onSaveDefense: (fine: Fine, defense: string) => void;
};

export function GroupFineAccordion({
    groupSlug,
    fines,
    canManage,
    readOnly,
    currentUserId,
    onApprove,
    onMarkPaid,
    onDelete,
    onSaveDefense,
}: GroupFineAccordionProps) {
    return (
        <Card size="sm">
            <CardContent className="p-0">
                <Accordion multiple>
                    {fines.map((fine) => (
                        <GroupFineAccordionItem
                            key={fine.id}
                            groupSlug={groupSlug}
                            fine={fine}
                            canManage={canManage}
                            readOnly={readOnly}
                            currentUserId={currentUserId}
                            onApprove={onApprove}
                            onMarkPaid={onMarkPaid}
                            onDelete={onDelete}
                            onSaveDefense={onSaveDefense}
                        />
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}

function GroupFineAccordionItem({
    groupSlug,
    fine,
    canManage,
    readOnly,
    currentUserId,
    onApprove,
    onMarkPaid,
    onDelete,
    onSaveDefense,
}: Omit<GroupFineAccordionProps, "fines"> & { fine: Fine }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [defenseDraft, setDefenseDraft] = useState<string | null>(null);

    return (
        <AccordionItem value={fine.id} className="px-3">
            <AccordionTrigger className="items-center py-2 hover:no-underline">
                <GroupFineRow fine={fine} />
            </AccordionTrigger>
            <AccordionContent>
                <GroupFineDetails
                    groupSlug={groupSlug}
                    fine={fine}
                    canManage={canManage}
                    readOnly={readOnly}
                    currentUserId={currentUserId}
                    defenseDraft={defenseDraft}
                    onDefenseDraftChange={setDefenseDraft}
                    onApprove={onApprove}
                    onMarkPaid={onMarkPaid}
                    onDelete={onDelete}
                    onSaveDefense={onSaveDefense}
                />
            </AccordionContent>
            {canManage ? (
                <AlertDialog
                    open={confirmDelete}
                    onOpenChange={setConfirmDelete}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Slett boten?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Boten fjernes for godt og forsvinner fra
                                gruppens oversikt.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel variant="outline" size="default">
                                Avbryt
                            </AlertDialogCancel>
                            <AlertDialogAction
                                variant="destructive"
                                onClick={() => {
                                    onDelete(fine);
                                    setConfirmDelete(false);
                                }}
                            >
                                Slett bot
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            ) : null}
        </AccordionItem>
    );
}
