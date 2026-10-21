import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@tihlde/ui/ui/alert-dialog";
import { Button } from "@tihlde/ui/ui/button";
import { UserPlus } from "lucide-react";
import { useState } from "react";

type GroupSelfJoinButtonProps = {
    groupName: string;
    onJoin: () => void;
    isPending?: boolean;
};

export function GroupSelfJoinButton({
    groupName,
    onJoin,
    isPending = false,
}: GroupSelfJoinButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger
                render={
                    <Button disabled={isPending}>
                        <UserPlus />
                        Bli med
                    </Button>
                }
            />
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Bli med i {groupName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Lederne får beskjed om at du har blitt med.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel variant="outline" size="default">
                        Avbryt
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isPending}
                        onClick={() => {
                            setOpen(false);
                            onJoin();
                        }}
                    >
                        Bli med
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
