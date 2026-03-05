import type { NewsListItem } from "@tihlde/sdk/types";
import { Card } from "~/components/ui/card";
import { formatDate } from "~/lib/date";

type NewsCardProps = {
    news: NewsListItem;
};

export function NewsCard({ news }: NewsCardProps) {
    return (
        <a href={`/nyheter/${news.id}`}>
            <Card className="group overflow-hidden transition-shadow hover:shadow-md">
                {news.imageUrl && (
                    <div className="aspect-[2/1] overflow-hidden">
                        <img
                            src={news.imageUrl}
                            alt={news.imageAlt ?? news.title}
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>
                )}
                <div className="space-y-2 p-4">
                    <p className="text-xs text-muted-foreground">
                        {formatDate(news.createdAt)}
                    </p>
                    <h3 className="font-heading text-lg font-semibold leading-tight group-hover:text-primary">
                        {news.title}
                    </h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                        {news.header}
                    </p>
                </div>
            </Card>
        </a>
    );
}
