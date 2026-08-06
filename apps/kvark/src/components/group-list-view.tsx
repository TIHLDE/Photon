import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@tihlde/ui/ui/card";

import { GroupIdentity } from "#/components/group-identity";
import type {
    Branch,
    GroupTreeInput,
    SimpleSection,
} from "#/lib/build-group-tree";

function flattenBranches(branches: Branch[]): SimpleSection[] {
    return branches.flatMap((branch) => {
        if ("items" in branch) return [branch];
        return branch.children.map((child) => ({
            ...child,
            label: `${branch.label} – ${child.label}`,
        }));
    });
}

/**
 * Flat, section-by-section card listing of every group. Doubles as the mobile
 * rendering of the hierarchy view, where the org chart is too wide to read.
 */
export function GroupListView({ tree }: { tree: GroupTreeInput }) {
    const sections = [...tree.main, ...flattenBranches(tree.branches)].filter(
        (section) => section.items.length > 0,
    );

    return (
        <div className="flex flex-col gap-6">
            {sections.map((section) => (
                <section key={section.id} className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold">{section.label}</h2>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {section.items.map((item) => (
                            <Link
                                key={item.slug}
                                className="block min-w-0 cursor-pointer"
                                to="/grupper/$slug"
                                params={{ slug: item.slug }}
                            >
                                <Card
                                    size="sm"
                                    className="h-full cursor-pointer"
                                >
                                    <CardContent className="flex items-center gap-3">
                                        <GroupIdentity {...item} />
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
