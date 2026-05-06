import { Card, CardContent, CardHeader, CardTitle } from "@tihlde/ui/ui/card";
import { Separator } from "@tihlde/ui/ui/separator";
import { Fragment, type ReactNode } from "react";

export type DetailsCardItem = ReactNode | ReactNode[];

type DetailsCardProps = {
    title: ReactNode;
    items: DetailsCardItem[];
};

export function DetailsCard({ title, items }: DetailsCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {items.map((item, i) => (
                    <Fragment key={i}>
                        {i > 0 ? <Separator /> : null}
                        {Array.isArray(item) ? (
                            <div className="flex flex-col gap-4">
                                {item.map((sub, j) => (
                                    <Fragment key={j}>{sub}</Fragment>
                                ))}
                            </div>
                        ) : (
                            item
                        )}
                    </Fragment>
                ))}
            </CardContent>
        </Card>
    );
}
