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
    leaderCount: number;
    /** Uten leder går beskjeden til gruppas e-post, om den har en. */
    hasContactEmail: boolean;
    onJoin: () => void;
    isPending?: boolean;
};

export function GroupSelfJoinButton({
    groupName,
    leaderCount,
    hasContactEmail,
    onJoin,
    isPending = false,
}: GroupSelfJoinButtonProps) {
    const [open, setOpen] = useState(false);
    const notice =
        leaderCount > 1
            ? { notified: "Lederne", pronoun: "De" }
            : leaderCount === 1
              ? { notified: "Lederen", pronoun: "Hen" }
              : hasContactEmail
                ? { notified: "Gruppa", pronoun: "De" }
                : null;

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
                    {notice ? (
                        <AlertDialogDescription>
                            {notice.notified} får beskjed om at du har blitt
                            med. {notice.pronoun} vil gi deg nødvendige
                            tilganger for å delta i gruppen.
                        </AlertDialogDescription>
                    ) : null}
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
