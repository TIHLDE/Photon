import { Card, CardContent } from "@tihlde/ui/ui/card";

import { assetImageProps } from "#/lib/assets";

export interface CompanyOfferCardProps {
    title: string;
    description: string;
    imageUrl: string;
    /** Places the image left of the text instead of right */
    imageFirst?: boolean;
}

export function CompanyOfferCard({
    title,
    description,
    imageUrl,
    imageFirst,
}: CompanyOfferCardProps) {
    return (
        <Card>
            <CardContent
                className={`flex flex-col gap-6 md:items-center ${
                    imageFirst ? "md:flex-row" : "md:flex-row-reverse"
                }`}
            >
                <div className="flex w-full flex-col gap-3 md:w-1/2">
                    <h2 className="text-2xl md:text-3xl">{title}</h2>
                    <p className="text-muted-foreground">{description}</p>
                </div>
                <div className="w-full md:w-1/2">
                    <img
                        {...assetImageProps(imageUrl, "card")}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        className="aspect-video h-auto w-full rounded-lg object-cover"
                    />
                </div>
            </CardContent>
        </Card>
    );
}
