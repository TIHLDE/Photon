import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ReactFlow, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo } from "react";

import { getGroupsQuery } from "#/api/queries/groups";
import { GroupTreeMobile } from "#/components/group-tree-mobile";
import {
    GroupTreeJunctionNode,
    type GroupTreeNodeData,
    GroupTreeNode,
    GroupTreeSectionNode,
    NODE_TYPE,
} from "#/components/group-tree-node";
import { useTheme } from "#/integrations/theme";
import {
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

export const Route = createFileRoute("/_app/grupper/")({
    component: GroupsPage,
    loader: ({ context }) =>
        context.queryClient.ensureQueryData(getGroupsQuery(0)),
});

type ApiGroup = {
    name: string;
    slug: string;
    type: string;
    contactEmail: string | null;
};

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
        items: groups
            .filter((g) => g.type === type)
            .map((g) => ({
                name: g.name,
                slug: g.slug,
                email: g.contactEmail ?? undefined,
            })),
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
        // same level in the organisation, but a category of their own.
        branches: [
            sectionFrom(
                "interessegrupper",
                "Interessegrupper",
                3,
                groups,
                "INTERESTGROUP",
            ),
            sectionFrom("idrettslag", "Idrettslag", 2, groups, "SPORTSTEAM"),
        ],
    };
}

function GroupsPage() {
    const { theme } = useTheme();
    const navigate = useNavigate();

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

    return (
        <div className="container mx-auto flex w-full flex-col gap-4 px-4 py-8">
            <h1 className="text-center text-2xl">Gruppeoversikt</h1>

            <div className="md:hidden">
                <GroupTreeMobile tree={tree} />
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
        </div>
    );
}
