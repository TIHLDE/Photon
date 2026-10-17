import { HandCoins, ShieldCheck } from "lucide-react";

import type { Fine } from "#/lib/group";
import { Text } from "@tihlde/ui/ui/text";

export function GroupFineRow({ fine }: { fine: Fine }) {
    return (
        <div className="flex flex-1 items-center gap-3 pr-3">
            <Text render={<span />} size="2xl" weight="medium">
                {fine.amount}
            </Text>
            <div className="flex min-w-0 flex-1 flex-col">
                {/* `truncate` hører hjemme på navnet, ikke på flex-raden:
                    text-overflow virker ikke på en flex-boks, så der ble
                    badgene bak navnet bare klippet midt av uten ellipse. */}
                <Text
                    render={<span />}
                    weight="medium"
                    className="flex items-center gap-1"
                >
                    <span className="truncate">{fine.user}</span>
                    {fine.approved ? <ShieldCheck className="size-4" /> : null}
                    {fine.paid ? <HandCoins className="size-4" /> : null}
                </Text>
                <Text
                    render={<span />}
                    size="sm"
                    tone="muted"
                    className="truncate"
                >
                    {fine.paragraph ? `${fine.paragraph} - ` : ""}
                    {fine.title}
                </Text>
            </div>
        </div>
    );
}
