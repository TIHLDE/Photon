import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@tihlde/ui/ui/card";

import { GroupIdentity } from "#/components/group-identity";
import type {
    Branch,
    GroupTreeInput,
    SimpleSection,
} from "#/lib/build-group-tree";
import { groupHref } from "#/lib/utils";

function flattenBranches(branches: Branch[]): SimpleSection[] {
    return branches.flatMap((branch) => {
        if ("items" in branch) return [branch];
        return branch.children.map((child) => ({
            ...child,
            label: `${branch.label} – ${child.label}`,
        }));
    });
}

export function GroupTreeMobile({ tree }: { tree: GroupTreeInput }) {
    const sections = [...tree.main, ...flattenBranches(tree.branches)];
    return (
        <div className="flex flex-col gap-6">
            {sections.map((section) => (
                <section key={section.id} className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold">{section.label}</h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {section.items.map((item) => (
                            <Link
                                key={item.name}
                                className="block cursor-pointer"
                                to={groupHref(item.name)}
                            >
                                <Card size="sm">
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
