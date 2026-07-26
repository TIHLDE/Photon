import { Badge } from "@tihlde/ui/ui/badge";
import type { ApplicationStatus } from "#/api/queries/applications";

const variantByStatus: Record<
    ApplicationStatus,
    "default" | "secondary" | "outline" | "destructive"
> = {
    new: "default",
    in_progress: "secondary",
    approved: "outline",
    rejected: "destructive",
};

type ApplicationStatusBadgeProps = {
    status: ApplicationStatus;
    label: string;
};

export function ApplicationStatusBadge({
    status,
    label,
}: ApplicationStatusBadgeProps) {
    return <Badge variant={variantByStatus[status]}>{label}</Badge>;
}
