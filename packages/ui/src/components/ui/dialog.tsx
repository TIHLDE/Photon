import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "#/lib/utils";
import { Button } from "#/components/ui/button";
import { XIcon } from "lucide-react";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
    className,
    ...props
}: DialogPrimitive.Backdrop.Props) {
    return (
        <DialogPrimitive.Backdrop
            data-slot="dialog-overlay"
            className={cn(
                "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
                className,
            )}
            {...props}
        />
    );
}

function DialogContent({
    className,
    children,
    showCloseButton = true,
    ...props
}: DialogPrimitive.Popup.Props & {
    showCloseButton?: boolean;
}) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Popup
                data-slot="dialog-content"
                className={cn(
                    // max-h + overflow: uten dem vokser popupen symmetrisk ut
                    // over begge skjermkanter når innholdet er høyere enn
                    // viewporten — tittel og lukkeknapp havner over toppen,
                    // handlingsknappene under bunnen, og siden er `fixed` kan
                    // ingen av dem nås. overscroll-contain hindrer at siden bak
                    // tar over scrollingen når popupen når enden.
                    //
                    // flex-col (ikke grid): lar `DialogBody` ta resthøyden og
                    // scrolle for seg selv, slik at header og footer står låst.
                    // Uten DialogBody scroller popupen selv, som før — og med
                    // en DialogBody skal den aldri scrolle, ellers glir den
                    // låste headeren ut av synet likevel.
                    "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto overscroll-contain rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none has-data-[slot=dialog-body]:overflow-hidden sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                    className,
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close
                        data-slot="dialog-close"
                        render={
                            <Button
                                variant="ghost"
                                className="absolute top-2 right-2"
                                size="icon-sm"
                            />
                        }
                    >
                        <XIcon />
                        <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Popup>
        </DialogPortal>
    );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-header"
            className={cn("flex shrink-0 flex-col gap-2", className)}
            {...props}
        />
    );
}

/**
 * Valgfri scrollcontainer for innholdet mellom `DialogHeader` og
 * `DialogFooter`. Uten den scroller hele popupen, og tittel, lukkeknapp og
 * handlingsknapper forsvinner ut av synet hver sin vei. Med den låses header og
 * footer, og bare innholdet mellom dem scroller.
 *
 * Bruk den når innholdet kan bli høyere enn skjermen (skjemaer, lister,
 * bildeforhåndsvisninger). Korte dialoger trenger den ikke.
 *
 * `min-h-0` er ikke valgfri: uten den lar ikke flex-elementet seg krympe under
 * innholdshøyden, og scrollingen havner på popupen igjen. `flex-col gap-4`
 * gjenskaper avstanden barna hadde som direkte barn av `DialogContent`.
 *
 * `relative` er heller ikke valgfri: uten den er popupen (som er `fixed`)
 * containing block for absolutt posisjonerte etterkommere — f.eks. overlegget i
 * `ImageDropzone` — så de slipper unna klippingen her og gir popupen sin egen
 * scrollhøyde igjen. Målt i annonse-dialogen: 1251px scrollhøyde uten
 * `relative`, 780px (= synlig høyde) med.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-body"
            className={cn(
                "relative -mx-4 flex min-h-0 flex-auto flex-col gap-4 overflow-y-auto overscroll-contain px-4",
                className,
            )}
            {...props}
        />
    );
}

function DialogFooter({
    className,
    showCloseButton = false,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    showCloseButton?: boolean;
}) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                "-mx-4 -mb-4 flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
                className,
            )}
            {...props}
        >
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close render={<Button variant="outline" />}>
                    Close
                </DialogPrimitive.Close>
            )}
        </div>
    );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn(
                // wrap-anywhere, ikke break-words: den påvirker også
                // min-content-bredden, så et langt ord uten mellomrom ikke
                // presser hele dialogen bredere enn skjermen.
                "font-heading wrap-anywhere text-base leading-none font-medium",
                className,
            )}
            {...props}
        />
    );
}

function DialogDescription({
    className,
    ...props
}: DialogPrimitive.Description.Props) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn(
                "wrap-anywhere text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
                className,
            )}
            {...props}
        />
    );
}

export {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
