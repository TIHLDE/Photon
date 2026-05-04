import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@tihlde/ui/ui/card";
import { Separator } from "@tihlde/ui/ui/separator";
import { Fragment, type ReactNode } from "react";

type DetailsCardProps = {
    title: ReactNode;
    items: ReactNode[];
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
                        {item}
                    </Fragment>
                ))}
            </CardContent>
        </Card>
    );
}
