import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@tihlde/ui/ui/progress";
import { Text } from "@tihlde/ui/ui/text";

import type { FormQuestionStatistics } from "#/lib/form";

type FormStatisticsListProps = {
    statistics: FormQuestionStatistics[];
};

export function FormStatisticsList({ statistics }: FormStatisticsListProps) {
    if (statistics.length === 0) {
        return (
            <Text size="sm" tone="muted">
                Skjemaet har ingen spørsmål med alternativer, så det er ingen
                fordeling å vise. Fritekstsvarene ligger under «Svar».
            </Text>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {statistics.map((question) => (
                <Card key={question.id}>
                    <CardHeader>
                        <CardTitle>{question.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        {question.options.map((option) => (
                            <Progress key={option.id} value={option.percentage}>
                                <ProgressLabel>{option.title}</ProgressLabel>
                                <ProgressValue>
                                    {() =>
                                        `${option.count} (${option.percentage} %)`
                                    }
                                </ProgressValue>
                            </Progress>
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
