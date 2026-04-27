import type { Edge, Node } from "@xyflow/react";

import {
    GROUP_NODE_HEIGHT,
    GROUP_NODE_WIDTH,
    HANDLE,
    HEADER_NODE_HEIGHT,
    HEADER_NODE_WIDTH,
    NODE_TYPE,
    type GroupTreeNodeData,
} from "#/components/group-tree-node";

const COL_GAP = 24;
const ROW_GAP = 24;
const SECTION_GAP = 56;
const SUB_GAP = 64;
const BRANCH_GAP = 56;
const PARENT_SUB_GAP = 64;
const HEADER_BLOCK = HEADER_NODE_HEIGHT + ROW_GAP;

export type SimpleSection = {
    id: string;
    label: string;
    cols: 1 | 2 | 3;
    items: GroupTreeNodeData[];
};

export type GroupedSection = {
    id: string;
    label: string;
    children: SimpleSection[];
};

export type Branch = SimpleSection | GroupedSection;

export type GroupTreeInput = {
    main: SimpleSection[];
    branches: Branch[];
};

export type GroupTreeOutput = {
    nodes: Node[];
    edges: Edge[];
    width: number;
    height: number;
};

type SectionLayout = {
    nodes: Node[];
    edges: Edge[];
    nextY: number;
    headerId: string;
    lastSpineId: string;
};

function colsWidth(cols: number): number {
    return cols * GROUP_NODE_WIDTH + Math.max(0, cols - 1) * COL_GAP;
}

function sectionWidth(section: SimpleSection): number {
    return colsWidth(section.cols);
}

function sectionSpineX(section: SimpleSection, x: number): number {
    return x + colsWidth(section.cols) / 2;
}

function itemX(x: number, col: number): number {
    return x + col * (GROUP_NODE_WIDTH + COL_GAP);
}

function branchWidth(branch: Branch): number {
    if ("items" in branch) return sectionWidth(branch);
    const inner = branch.children.reduce(
        (sum, child) => sum + sectionWidth(child),
        0,
    );
    return inner + Math.max(0, branch.children.length - 1) * SUB_GAP;
}

function headerNode(
    id: string,
    label: string,
    centerX: number,
    y: number,
): Node {
    return {
        id,
        type: NODE_TYPE.section,
        position: { x: centerX - HEADER_NODE_WIDTH / 2, y },
        data: { label },
        draggable: false,
        selectable: false,
    };
}

function junctionNode(
    id: string,
    x: number,
    y: number,
    arms: { up: boolean; down: boolean; left: boolean; right: boolean },
): Node {
    return {
        id,
        type: NODE_TYPE.junction,
        position: { x: Math.round(x) - 1, y: Math.round(y) - 1 },
        data: arms,
        width: 2,
        height: 2,
        style: { width: 2, height: 2 },
        draggable: false,
        selectable: false,
    };
}

function edge(
    source: string,
    target: string,
    opts: Partial<Edge> = {},
): Edge {
    return {
        id: `${source}->${target}`,
        source,
        target,
        sourceHandle: HANDLE.bottomSource,
        targetHandle: HANDLE.topTarget,
        ...opts,
    };
}

function placeItems(
    section: SimpleSection,
    x: number,
    itemsY: number,
): Node[] {
    return section.items.map((item, index) => {
        const col = index % section.cols;
        const row = Math.floor(index / section.cols);
        return {
            id: `${section.id}-item-${index}`,
            type: NODE_TYPE.group,
            position: {
                x: itemX(x, col),
                y: itemsY + row * (GROUP_NODE_HEIGHT + ROW_GAP),
            },
            data: item,
            draggable: false,
            style: { cursor: "pointer" },
        };
    });
}

function layoutOneCol(
    section: SimpleSection,
    x: number,
    headerY: number,
    itemsY: number,
): SectionLayout {
    const sx = sectionSpineX(section, x);
    const nodes: Node[] = [
        headerNode(section.id, section.label, sx, headerY),
        ...placeItems(section, x, itemsY),
    ];
    const edges: Edge[] = [];

    if (section.items.length > 0) {
        edges.push(
            edge(section.id, `${section.id}-item-0`, { type: "straight" }),
        );
        for (let i = 0; i < section.items.length - 1; i++) {
            edges.push(
                edge(
                    `${section.id}-item-${i}`,
                    `${section.id}-item-${i + 1}`,
                    { type: "straight" },
                ),
            );
        }
    }

    const rows = Math.max(1, section.items.length);
    const lastSpineId =
        section.items.length > 0
            ? `${section.id}-item-${section.items.length - 1}`
            : section.id;
    return {
        nodes,
        edges,
        nextY: itemsY + rows * GROUP_NODE_HEIGHT + (rows - 1) * ROW_GAP,
        headerId: section.id,
        lastSpineId,
    };
}

function layoutTwoCol(
    section: SimpleSection,
    x: number,
    headerY: number,
    itemsY: number,
    extendsBeyond: boolean,
): SectionLayout {
    const sx = sectionSpineX(section, x);
    const rows = Math.max(1, Math.ceil(section.items.length / 2));
    const nodes: Node[] = [
        headerNode(section.id, section.label, sx, headerY),
        ...placeItems(section, x, itemsY),
    ];
    const edges: Edge[] = [];

    for (let row = 0; row < rows; row++) {
        const id = `${section.id}-spine-${row}`;
        const isLastRow = row === rows - 1;
        nodes.push(
            junctionNode(
                id,
                sx,
                itemsY +
                    row * (GROUP_NODE_HEIGHT + ROW_GAP) +
                    GROUP_NODE_HEIGHT / 2,
                {
                    up: true,
                    down: !isLastRow || extendsBeyond,
                    left: row * 2 < section.items.length,
                    right: row * 2 + 1 < section.items.length,
                },
            ),
        );
        const prev = row === 0 ? section.id : `${section.id}-spine-${row - 1}`;
        edges.push(edge(prev, id, { type: "straight" }));
    }

    section.items.forEach((_, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const itemId = `${section.id}-item-${index}`;
        const fromLeft = col === 0;
        edges.push(
            edge(`${section.id}-spine-${row}`, itemId, {
                sourceHandle: fromLeft
                    ? HANDLE.leftSource
                    : HANDLE.rightSource,
                targetHandle: fromLeft
                    ? HANDLE.rightTarget
                    : HANDLE.leftTarget,
                type: "straight",
            }),
        );
    });

    return {
        nodes,
        edges,
        nextY: itemsY + rows * GROUP_NODE_HEIGHT + (rows - 1) * ROW_GAP,
        headerId: section.id,
        lastSpineId: `${section.id}-spine-${rows - 1}`,
    };
}

function layoutThreeCol(
    section: SimpleSection,
    x: number,
    headerY: number,
    itemsY: number,
): SectionLayout {
    const sx = sectionSpineX(section, x);
    const rows = Math.max(1, Math.ceil(section.items.length / 3));
    const nodes: Node[] = [
        headerNode(section.id, section.label, sx, headerY),
        ...placeItems(section, x, itemsY),
    ];
    const edges: Edge[] = [];

    const middleId = (row: number) => {
        const middleIndex = row * 3 + 1;
        if (middleIndex >= section.items.length) {
            return `${section.id}-item-${section.items.length - 1}`;
        }
        return `${section.id}-item-${middleIndex}`;
    };

    edges.push(edge(section.id, middleId(0), { type: "straight" }));
    for (let row = 0; row < rows - 1; row++) {
        edges.push(edge(middleId(row), middleId(row + 1), { type: "straight" }));
    }

    for (let row = 0; row < rows; row++) {
        const leftIdx = row * 3;
        const rightIdx = row * 3 + 2;
        const middle = middleId(row);
        if (leftIdx < section.items.length && leftIdx !== row * 3 + 1) {
            edges.push(
                edge(middle, `${section.id}-item-${leftIdx}`, {
                    sourceHandle: HANDLE.leftSource,
                    targetHandle: HANDLE.rightTarget,
                    type: "straight",
                }),
            );
        }
        if (rightIdx < section.items.length) {
            edges.push(
                edge(middle, `${section.id}-item-${rightIdx}`, {
                    sourceHandle: HANDLE.rightSource,
                    targetHandle: HANDLE.leftTarget,
                    type: "straight",
                }),
            );
        }
    }

    return {
        nodes,
        edges,
        nextY: itemsY + rows * GROUP_NODE_HEIGHT + (rows - 1) * ROW_GAP,
        headerId: section.id,
        lastSpineId: middleId(rows - 1),
    };
}

function layoutSection(
    section: SimpleSection,
    x: number,
    headerY: number,
    itemsY: number,
    extendsBeyond: boolean,
): SectionLayout {
    if (section.cols === 1) return layoutOneCol(section, x, headerY, itemsY);
    if (section.cols === 2)
        return layoutTwoCol(section, x, headerY, itemsY, extendsBeyond);
    return layoutThreeCol(section, x, headerY, itemsY);
}

export function buildGroupTree(data: GroupTreeInput): GroupTreeOutput {
    const mainW = Math.max(...data.main.map(sectionWidth));
    const branchWidths = data.branches.map(branchWidth);
    const branchesTotalW =
        branchWidths.reduce((sum, w) => sum + w, 0) +
        Math.max(0, data.branches.length - 1) * BRANCH_GAP;

    const totalW = Math.max(mainW, branchesTotalW);

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    let y = 0;
    let prevLastSpineId: string | null = null;

    for (const section of data.main) {
        const sw = sectionWidth(section);
        const layout = layoutSection(
            section,
            (totalW - sw) / 2,
            y,
            y + HEADER_BLOCK,
            true,
        );
        if (prevLastSpineId) {
            edges.push(
                edge(prevLastSpineId, section.id, { type: "straight" }),
            );
        }
        nodes.push(...layout.nodes);
        edges.push(...layout.edges);
        prevLastSpineId = layout.lastSpineId;
        y = layout.nextY + SECTION_GAP;
    }

    const branchHeaderY = y;
    const subHeaderY = branchHeaderY + HEADER_NODE_HEIGHT + PARENT_SUB_GAP;
    const hasGrouped = data.branches.some((b) => !("items" in b));
    const branchItemsY = hasGrouped
        ? subHeaderY + HEADER_BLOCK
        : branchHeaderY + HEADER_BLOCK;

    let cursorX = (totalW - branchesTotalW) / 2;
    let maxNextY = y;

    for (const [i, branch] of data.branches.entries()) {
        if ("items" in branch) {
            const layout = layoutSection(
                branch,
                cursorX,
                branchHeaderY,
                branchItemsY,
                false,
            );
            if (prevLastSpineId) {
                edges.push(
                    edge(prevLastSpineId, branch.id),
                );
            }
            nodes.push(...layout.nodes);
            edges.push(...layout.edges);
            maxNextY = Math.max(maxNextY, layout.nextY);
        } else {
            const totalSubW = branchWidth(branch);
            nodes.push(
                headerNode(
                    branch.id,
                    branch.label,
                    cursorX + totalSubW / 2,
                    branchHeaderY,
                ),
            );
            if (prevLastSpineId) {
                edges.push(
                    edge(prevLastSpineId, branch.id),
                );
            }

            let subCursorX = cursorX;
            for (const sub of branch.children) {
                const subLayout = layoutSection(
                    sub,
                    subCursorX,
                    subHeaderY,
                    subHeaderY + HEADER_BLOCK,
                    false,
                );
                edges.push(edge(branch.id, sub.id));
                nodes.push(...subLayout.nodes);
                edges.push(...subLayout.edges);
                subCursorX += sectionWidth(sub) + SUB_GAP;
                maxNextY = Math.max(maxNextY, subLayout.nextY);
            }
        }
        cursorX += branchWidths[i] + BRANCH_GAP;
    }

    return { nodes, edges, width: totalW, height: maxNextY };
}
