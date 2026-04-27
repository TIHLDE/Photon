import { Link } from "@tanstack/react-router";
import { Card } from "@tihlde/ui/ui/card";
import { Handle, Position } from "@xyflow/react";
import { Fragment } from "react";

import {
    GroupIdentity,
    type GroupIdentityProps,
} from "#/components/group-identity";
import { groupHref } from "#/lib/utils";

export const GROUP_NODE_WIDTH = 288;
export const GROUP_NODE_HEIGHT = 92;
export const HEADER_NODE_WIDTH = 168;
export const HEADER_NODE_HEIGHT = 32;

export const NODE_TYPE = {
    group: "groupTreeNode",
    section: "groupTreeSection",
    junction: "groupTreeJunction",
} as const;

export const HANDLE = {
    topSource: "top-s",
    topTarget: "top-t",
    bottomSource: "bottom-s",
    bottomTarget: "bottom-t",
    leftSource: "left-s",
    leftTarget: "left-t",
    rightSource: "right-s",
    rightTarget: "right-t",
} as const;

const HIDDEN_HANDLE_STYLE = {
    visibility: "hidden",
    pointerEvents: "none",
} as const;

const GROUP_NODE_STYLE = {
    width: GROUP_NODE_WIDTH,
    height: GROUP_NODE_HEIGHT,
    cursor: "pointer",
} as const;

const HEADER_NODE_STYLE = {
    width: HEADER_NODE_WIDTH,
    height: HEADER_NODE_HEIGHT,
} as const;

const POSITION_BY_SIDE = {
    top: Position.Top,
    bottom: Position.Bottom,
    left: Position.Left,
    right: Position.Right,
} as const;

type HandleSide = keyof typeof POSITION_BY_SIDE;

function HiddenHandles({ sides }: { sides: readonly HandleSide[] }) {
    return (
        <>
            {sides.map((side) => (
                <Fragment key={side}>
                    <Handle
                        id={`${side}-s`}
                        position={POSITION_BY_SIDE[side]}
                        style={HIDDEN_HANDLE_STYLE}
                        type="source"
                    />
                    <Handle
                        id={`${side}-t`}
                        position={POSITION_BY_SIDE[side]}
                        style={HIDDEN_HANDLE_STYLE}
                        type="target"
                    />
                </Fragment>
            ))}
        </>
    );
}

const GROUP_HANDLES = ["top", "bottom", "left", "right"] as const;
const SECTION_HANDLES = ["top", "bottom"] as const;
const JUNCTION_HANDLES = ["top", "bottom", "left", "right"] as const;

export type GroupTreeNodeData = GroupIdentityProps;

export function GroupTreeNode({ data }: { data: GroupTreeNodeData }) {
    return (
        <>
            <HiddenHandles sides={GROUP_HANDLES} />
            <Link
                className="nopan nodrag block cursor-pointer"
                style={GROUP_NODE_STYLE}
                to={groupHref(data.name)}
            >
                <Card
                    className="flex h-full flex-row items-center gap-3 px-3 py-2"
                    size="sm"
                >
                    <GroupIdentity {...data} />
                </Card>
            </Link>
        </>
    );
}

export type GroupTreeSectionData = {
    label: string;
};

export function GroupTreeSectionNode({ data }: { data: GroupTreeSectionData }) {
    return (
        <>
            <HiddenHandles sides={SECTION_HANDLES} />
            <div
                className="flex items-center justify-center rounded-lg bg-muted text-sm font-medium"
                style={HEADER_NODE_STYLE}
            >
                {data.label}
            </div>
        </>
    );
}

const JUNCTION_ARM = 6;

export type GroupTreeJunctionData = {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
};

export function GroupTreeJunctionNode({
    data,
}: {
    data: GroupTreeJunctionData;
}) {
    const upArm = data.up ? JUNCTION_ARM : 0;
    const downArm = data.down ? JUNCTION_ARM : 0;
    const leftArm = data.left ? JUNCTION_ARM : 0;
    const rightArm = data.right ? JUNCTION_ARM : 0;

    return (
        <div
            style={{
                position: "relative",
                width: 2,
                height: 2,
                overflow: "visible",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    top: -upArm,
                    width: 2,
                    height: 2 + upArm + downArm,
                    background: "var(--foreground)",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    left: -leftArm,
                    top: 0,
                    width: 2 + leftArm + rightArm,
                    height: 2,
                    background: "var(--foreground)",
                }}
            />
            <HiddenHandles sides={JUNCTION_HANDLES} />
        </div>
    );
}
