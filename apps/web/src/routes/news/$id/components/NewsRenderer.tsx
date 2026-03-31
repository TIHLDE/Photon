import { Link } from "@tanstack/react-router";
import TIHLDE_LOGO from "~/assets/img/TihldeBackground.jpg";
import MarkdownRenderer from "~/components/miscellaneous/MarkdownRenderer";
import ShareButton from "~/components/miscellaneous/ShareButton";
import UpdatedAgo from "~/components/miscellaneous/UpdatedAgo";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import type { NewsArticle } from "~/api/queries/news";
import { formatDate } from "~/utils";
import { parseISO } from "date-fns";

export type NewsRendererProps = {
  data: NewsArticle;
  preview?: boolean;
};

const NewsRenderer = ({ data, preview = false }: NewsRendererProps) => {
  return (
    <div>
      <div className="px-4 mx-auto max-w-4xl w-full pb-10">
        <div className="space-y-2">
          <h1 className="text-2xl break-words lg:text-4xl font-semibold">{data.title}</h1>
          <h1 className="break-words lg:text-lg">{data.header}</h1>
        </div>
        <Separator className="my-6 bg-secondary-foreground dark:bg-border" />
        <div className="space-y-2">
          {data.creator && (
            <h1>
              Skrevet av{" "}
              <Link className="underline" to="/profil/{-$userId}" params={{ userId: data.creator.id }}>
                {data.creator.name}
              </Link>
            </h1>
          )}
          <h1 className="text-sm text-muted-foreground">{formatDate(parseISO(data.createdAt), { time: false })}</h1>
          {data.updatedAt && <UpdatedAgo updatedAt={data.updatedAt} />}
        </div>
      </div>

      <div className="px-4 mx-auto max-w-4xl w-full space-y-4 lg:space-y-8">
        <img alt={data.imageAlt || data.title} className="rounded-md aspect-auto mx-auto" src={data.imageUrl || TIHLDE_LOGO} />

        <div className="space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between">
          <div className="flex items-center space-x-2">{!preview && <ShareButton shareId={data.id} shareType="news" title={data.title} />}</div>
        </div>

        <Separator className="bg-secondary-foreground dark:bg-border" />

        <div>
          <MarkdownRenderer value={data.body} />
        </div>
      </div>
    </div>
  );
};

export default NewsRenderer;

export const NewsRendererLoading = () => (
  <div className="space-y-4">
    <Skeleton className="h-60" />
    <Skeleton className="h-96" />
  </div>
);
