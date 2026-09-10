import { HandCoins, ShieldCheck } from "lucide-react";

import type { Fine } from "#/lib/group";

export function GroupFineRow({ fine }: { fine: Fine }) {
    return (
        <div className="flex flex-1 items-center gap-3 pr-3">
            <span className="text-2xl font-medium">{fine.amount}</span>
            <div className="flex min-w-0 flex-1 flex-col">
                {/* `truncate` hører hjemme på navnet, ikke på flex-raden:
                    text-overflow virker ikke på en flex-boks, så der ble
                    badgene bak navnet bare klippet midt av uten ellipse. */}
                <span className="flex items-center gap-1 font-medium">
                    <span className="truncate">{fine.user}</span>
                    {fine.approved ? <ShieldCheck className="size-4" /> : null}
                    {fine.paid ? <HandCoins className="size-4" /> : null}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                    {fine.paragraph ? `${fine.paragraph} - ` : ""}
                    {fine.title}
                </span>
            </div>
        </div>
    );
}
