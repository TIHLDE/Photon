import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Text } from "@tihlde/ui/ui/text";

export interface StudyProgrammeCardProps {
    title: string;
    description: string;
    /** Rendered below the description — e.g. a "Les mer" link */
    action?: React.ReactNode;
}

export function StudyProgrammeCard({
    title,
    description,
    action,
}: StudyProgrammeCardProps) {
    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-xl">{title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
                <Text tone="muted" className="flex-1">
                    {description}
                </Text>
                {action && <div className="flex justify-end">{action}</div>}
            </CardContent>
        </Card>
    );
}
