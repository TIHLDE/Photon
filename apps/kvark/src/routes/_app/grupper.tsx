import { createFileRoute } from "@tanstack/react-router";
import { ReactFlow, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback } from "react";

import { GroupTreeMobile } from "#/components/group-tree-mobile";
import {
    GroupTreeJunctionNode,
    GroupTreeNode,
    GroupTreeSectionNode,
    NODE_TYPE,
    type GroupTreeNodeData,
} from "#/components/group-tree-node";
import { useTheme } from "#/integrations/theme";
import { buildGroupTree } from "#/lib/build-group-tree";
import { groupHref } from "#/lib/utils";

import { TREE_MOCK } from "./grupper.mock";

const { nodes, edges, width, height } = buildGroupTree(TREE_MOCK);
const CHART_ASPECT = `${width} / ${height}`;

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

export const Route = createFileRoute("/_app/grupper")({
    component: GroupsPage,
});

function GroupsPage() {
    const { theme } = useTheme();

    const onNodeClick = useCallback((_event: unknown, node: Node) => {
        if (node.type !== NODE_TYPE.group) return;
        const data = node.data as GroupTreeNodeData;
        window.location.href = groupHref(data.name);
    }, []);

    return (
        <div className="container mx-auto flex w-full flex-col gap-4 px-4 py-8">
            <h1 className="text-center text-2xl">Gruppeoversikt</h1>

            <div className="md:hidden">
                <GroupTreeMobile tree={TREE_MOCK} />
            </div>

            <div
                className="hidden w-full md:block"
                style={{ aspectRatio: CHART_ASPECT }}
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
