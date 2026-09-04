import { QRCodeCanvas } from "qrcode.react";
import * as React from "react";

import { cn } from "#/lib/utils";

/**
 * The canvas is always drawn at 1024px and scaled down by CSS: the element a
 * member sees is a few hundred pixels wide, but `toDataURL` on the ref yields
 * a PNG large enough to print.
 *
 * The white plate is not decoration — scanners need the light modules to stay
 * light, so the code keeps its own background in both themes.
 */
function QRCode({
    value,
    logo,
    className,
    ref,
    ...props
}: Omit<React.ComponentProps<"div">, "ref"> & {
    value: string;
    /** Optional image to place in the center of the code. */
    logo?: string;
    /** The underlying canvas, so callers can export the code as a PNG. */
    ref?: React.Ref<HTMLCanvasElement>;
}) {
    return (
        <div
            data-slot="qr-code"
            className={cn("rounded-md bg-white p-3", className)}
            {...props}
        >
            <QRCodeCanvas
                ref={ref}
                size={1024}
                value={value}
                imageSettings={
                    logo
                        ? {
                              src: logo,
                              height: 160,
                              width: 160,
                              excavate: true,
                          }
                        : undefined
                }
                className="h-auto! w-full!"
            />
        </div>
    );
}

export { QRCode };
