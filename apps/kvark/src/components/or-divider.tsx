import { Separator } from "@tihlde/ui/ui/separator";
import { Text } from "@tihlde/ui/ui/text";

/**
 * Horizontal divider with a small label in the middle, used to separate
 * primary and alternative actions (e.g. password login vs. Feide).
 */
export function OrDivider({ label = "eller" }: { label?: string }) {
    return (
        <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <Text render={<span />} size="xs" tone="muted">
                {label}
            </Text>
            <Separator className="flex-1" />
        </div>
    );
}
