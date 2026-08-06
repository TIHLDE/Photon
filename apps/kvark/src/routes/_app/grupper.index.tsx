import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@tihlde/ui/ui/tabs";
import { ReactFlow, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo } from "react";
import z from "zod";

import { getGroupsQuery } from "#/api/queries/groups";
import { GroupListView } from "#/components/group-list-view";
import {
    GroupTreeJunctionNode,
    type GroupTreeNodeData,
    GroupTreeNode,
    GroupTreeSectionNode,
    NODE_TYPE,
} from "#/components/group-tree-node";
import { useTheme } from "#/integrations/theme";
import {
    type Branch,
    buildGroupTree,
    type GroupTreeInput,
    type SimpleSection,
} from "#/lib/build-group-tree";

const NODE_TYPES = {
    [NODE_TYPE.group]: GroupTreeNode,
    [NODE_TYPE.section]: GroupTreeSectionNode,
    [NODE_TYPE.junction]: GroupTreeJunctionNode,
};
const DEFAULT_EDGE_OPTIONS = {
    type: "smoothstep",
    style: { stroke: "var(--foreground)", strokeWidth: 2 },
    pathOptions: { borderRadius: 24 },
};
const PRO_OPTIONS = { hideAttribution: true };
const TRANSPARENT_BG = { background: "transparent" } as const;
const FIT_VIEW_OPTIONS = { padding: 0.05 };

const VIEWS = [
    { value: "liste", label: "Liste" },
    { value: "hierarki", label: "Hierarki" },
] as const;

const searchSchema = z.object({
    visning: z.enum(["liste", "hierarki"]).default("liste").catch("liste"),
});

export const Route = createFileRoute("/_app/grupper/")({
    component: GroupsPage,
    validateSearch: searchSchema,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getGroupsQuery(0)),
});

type ApiGroup = {
    name: string;
    slug: string;
    type: string;
    subtype: string | null;
    contactEmail: string | null;
    logoUrl: string | null;
};

function itemsFrom(groups: ApiGroup[]) {
    return groups.map((g) => ({
        name: g.name,
        slug: g.slug,
        email: g.contactEmail ?? undefined,
        logoUrl: g.logoUrl ?? undefined,
    }));
}

function sectionFrom(
    id: string,
    label: string,
    cols: SimpleSection["cols"],
    groups: ApiGroup[],
    type: string,
): SimpleSection {
    return {
        id,
        label,
        cols,
        items: itemsFrom(groups.filter((g) => g.type === type)),
    };
}

/**
 * Interest groups split into the two categories the organisation actually
 * uses: ordinary groups and sports groups (distinct from IdKom's sports
 * teams, which are their own type).
 *
 * A group whose subtype is missing still has to appear somewhere — dropping
 * it would silently hide a real group from the chart — so it falls into
 * "Grupper", the broader of the two. Sections with no members are omitted
 * rather than rendered empty.
 */
function interestGroupBranch(groups: ApiGroup[]): Branch {
    const interest = groups.filter((g) => g.type === "INTERESTGROUP");
    const sports = interest.filter((g) => g.subtype === "IDRETTSGRUPPE");
    const rest = interest.filter((g) => g.subtype !== "IDRETTSGRUPPE");

    const children: SimpleSection[] = [];
    if (rest.length > 0) {
        children.push({
            id: "interessegrupper-gruppe",
            label: "Grupper",
            cols: 2,
            items: itemsFrom(rest),
        });
    }
    if (sports.length > 0) {
        children.push({
            id: "interessegrupper-idrett",
            label: "Idrettsgrupper",
            cols: 2,
            items: itemsFrom(sports),
        });
    }

    // Before the subtype is backfilled every group lands in one bucket, and a
    // grouped section with a single child is just a heading with a redundant
    // subheading under it. Fall back to the flat section in that case.
    if (children.length < 2) {
        return {
            id: "interessegrupper",
            label: "Interessegrupper",
            cols: 3,
            items: itemsFrom(interest),
        };
    }

    return {
        id: "interessegrupper",
        label: "Interessegrupper",
        children,
    };
}

function buildTreeInput(groups: ApiGroup[]): GroupTreeInput {
    return {
        main: [
            sectionFrom("hovedorgan", "Hovedorgan", 2, groups, "BOARD"),
            sectionFrom("undergrupper", "Undergrupper", 3, groups, "SUBGROUP"),
            sectionFrom("komiteer", "Komitéer", 3, groups, "COMMITTEE"),
        ],
        // Sports teams sit alongside interest groups rather than inside them:
        // same level in the organisation, but a category of their own. They
        // come first because they reach the widest — and the label carries
        // IdKom, since the chart otherwise reads as if the teams were their
        // own top-level category rather than IdKom's.
        branches: [
            sectionFrom(
                "idrettslag",
                "Idrettslag (IdKom)",
                2,
                groups,
                "SPORTSTEAM",
            ),
            interestGroupBranch(groups),
        ],
    };
}

function GroupsPage() {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const { visning } = Route.useSearch();

    const { data: groups } = useSuspenseQuery(getGroupsQuery(0));

    const tree = useMemo(() => buildTreeInput(groups as ApiGroup[]), [groups]);
    const { nodes, edges, width, height } = useMemo(
        () => buildGroupTree(tree),
        [tree],
    );
    const chartAspect = `${width} / ${height}`;

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            if (node.type !== NODE_TYPE.group) return;
            const data = node.data as GroupTreeNodeData;
            navigate({
                to: "/grupper/$slug",
                params: { slug: data.slug },
            });
        },
        [navigate],
    );

    const changeView = useCallback(
        (next: string) => {
            navigate({
                to: "/grupper",
                search: { visning: next as (typeof VIEWS)[number]["value"] },
                replace: true,
            });
        },
        [navigate],
    );

    return (
        <div className="container mx-auto flex w-full flex-col gap-4 px-4 py-8">
            <h1 className="text-center text-2xl">Gruppeoversikt</h1>

            <Tabs
                className="self-center"
                value={visning}
                onValueChange={changeView}
            >
                <TabsList>
                    {VIEWS.map((view) => (
                        <TabsTrigger key={view.value} value={view.value}>
                            {view.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {visning === "liste" ? <GroupListView tree={tree} /> : null}

            {/* The chart is mounted only while its tab is active — React Flow
                measures its container on mount and would lay out against a
                zero-size box if it were merely hidden with CSS. */}
            {visning === "hierarki" ? (
                <>
                    {/* The org chart is unreadable on narrow screens, so mobile
                        falls back to the same sectioned list. */}
                    <div className="md:hidden">
                        <GroupListView tree={tree} />
                    </div>

                    <div
                        className="hidden w-full md:block"
                        style={{ aspectRatio: chartAspect }}
                    >
                        <ReactFlow
                            colorMode={theme}
                            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                            defaultEdges={edges}
                            defaultNodes={nodes}
                            edgesFocusable={false}
                            edgesReconnectable={false}
                            elementsSelectable={false}
                            fitView
                            fitViewOptions={FIT_VIEW_OPTIONS}
                            maxZoom={1}
                            minZoom={0.2}
                            nodeTypes={NODE_TYPES}
                            nodesConnectable={false}
                            nodesDraggable={false}
                            nodesFocusable={false}
                            onNodeClick={onNodeClick}
                            panOnDrag={false}
                            panOnScroll={false}
                            preventScrolling={false}
                            proOptions={PRO_OPTIONS}
                            style={TRANSPARENT_BG}
                            zoomOnDoubleClick={false}
                            zoomOnPinch={false}
                            zoomOnScroll={false}
                        />
                    </div>
                </>
            ) : null}
        </div>
    );
}
