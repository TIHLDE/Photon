import { Link } from "@tanstack/react-router";
import {
    CameraControlButton,
    CameraScreen,
    CameraTitle,
} from "@tihlde/ui/ui/camera-viewfinder";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type WrappedCameraScreenProps = {
    slug: string;
    title: string;
    /** The top-right control, e.g. the torch. */
    action?: ReactNode;
    children: ReactNode;
};

/**
 * The camera page owns the whole screen: a round X back to the event, the
 * event in the middle, and whatever the page puts below. Fills the dynamic
 * viewport (`dvh`, so iOS Safari's toolbars are accounted for) and keeps
 * clear of the notch and the home indicator.
 */
export function WrappedCameraScreen({
    slug,
    title,
    action,
    children,
}: WrappedCameraScreenProps) {
    return (
        <CameraScreen>
            <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-3 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-center gap-2">
                    <CameraControlButton
                        render={
                            <Link to="/arrangementer/$slug" params={{ slug }} />
                        }
                        aria-label="Lukk kameraet"
                    >
                        <X />
                    </CameraControlButton>
                    <CameraTitle>{title}</CameraTitle>
                    <div className="flex justify-end">{action}</div>
                </div>
                {children}
            </div>
        </CameraScreen>
    );
}
