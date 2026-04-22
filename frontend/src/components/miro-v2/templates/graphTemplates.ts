import type { AnchorSide } from "@/components/miro-v2/utils/connectorLayout";
import type { BoardItem, CreateBoardItemData } from "@/lib/api/miroApi";

export type GraphTemplateId = "mind_map" | "flowchart";

export interface GraphTemplateNodeSpec {
  key: string;
  type: Extract<BoardItem["type"], "shape">;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  style: Record<string, any>;
}

export interface GraphTemplateEdgeSpec {
  fromKey: string;
  toKey: string;
  fromAnchor: AnchorSide;
  toAnchor: AnchorSide;
}

export interface GraphTemplateSpec {
  id: GraphTemplateId;
  name: string;
  nodes: GraphTemplateNodeSpec[];
  edges: GraphTemplateEdgeSpec[];
}

function shapeNode(params: {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  shapeType: "roundRect" | "ellipse";
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
}): GraphTemplateNodeSpec {
  const {
    key,
    x,
    y,
    width,
    height,
    content,
    shapeType,
    backgroundColor = "#ffffff",
    borderColor = "#111827",
    borderWidth = 2,
  } = params;
  return {
    key,
    type: "shape",
    x,
    y,
    width,
    height,
    content,
    style: { shapeType, backgroundColor, borderColor, borderWidth },
  };
}

export const graphTemplates: Record<GraphTemplateId, GraphTemplateSpec> = {
  mind_map: {
    id: "mind_map",
    name: "Mind map",
    nodes: [
      shapeNode({
        key: "root",
        x: 0,
        y: 0,
        width: 220,
        height: 90,
        content: "Topic",
        shapeType: "roundRect",
        backgroundColor: "#ffffff",
        borderColor: "#8b5cf6",
        borderWidth: 3,
      }),
      // Left branch
      shapeNode({
        key: "l1",
        x: -360,
        y: -140,
        width: 240,
        height: 74,
        content: "Left branch 1",
        shapeType: "roundRect",
        borderColor: "#ec4899",
        borderWidth: 3,
      }),
      shapeNode({
        key: "l2",
        x: -360,
        y: -40,
        width: 240,
        height: 74,
        content: "Left branch 2",
        shapeType: "roundRect",
        borderColor: "#ec4899",
        borderWidth: 3,
      }),
      shapeNode({
        key: "l3",
        x: -360,
        y: 60,
        width: 240,
        height: 74,
        content: "Left branch 3",
        shapeType: "roundRect",
        borderColor: "#ec4899",
        borderWidth: 3,
      }),
      // Right branch
      shapeNode({
        key: "r1",
        x: 340,
        y: -140,
        width: 260,
        height: 74,
        content: "Right branch 1",
        shapeType: "roundRect",
        borderColor: "#6366f1",
        borderWidth: 3,
      }),
      shapeNode({
        key: "r2",
        x: 340,
        y: -40,
        width: 260,
        height: 74,
        content: "Right branch 2",
        shapeType: "roundRect",
        borderColor: "#6366f1",
        borderWidth: 3,
      }),
      shapeNode({
        key: "r3",
        x: 340,
        y: 60,
        width: 260,
        height: 74,
        content: "Right branch 3",
        shapeType: "roundRect",
        borderColor: "#6366f1",
        borderWidth: 3,
      }),
    ],
    edges: [
      { fromKey: "root", toKey: "l1", fromAnchor: "left", toAnchor: "right" },
      { fromKey: "root", toKey: "l2", fromAnchor: "left", toAnchor: "right" },
      { fromKey: "root", toKey: "l3", fromAnchor: "left", toAnchor: "right" },
      { fromKey: "root", toKey: "r1", fromAnchor: "right", toAnchor: "left" },
      { fromKey: "root", toKey: "r2", fromAnchor: "right", toAnchor: "left" },
      { fromKey: "root", toKey: "r3", fromAnchor: "right", toAnchor: "left" },
    ],
  },
  flowchart: {
    id: "flowchart",
    name: "Flowchart",
    nodes: [
      shapeNode({
        key: "start",
        x: 0,
        y: 0,
        width: 140,
        height: 70,
        content: "Start",
        shapeType: "ellipse",
        backgroundColor: "#d1fae5",
        borderColor: "#059669",
        borderWidth: 3,
      }),
      shapeNode({
        key: "p1",
        x: -260,
        y: 150,
        width: 220,
        height: 80,
        content: "Step A",
        shapeType: "roundRect",
        backgroundColor: "#fef3c7",
        borderColor: "#d97706",
        borderWidth: 3,
      }),
      shapeNode({
        key: "p2",
        x: 120,
        y: 150,
        width: 220,
        height: 80,
        content: "Step B",
        shapeType: "roundRect",
        backgroundColor: "#fef3c7",
        borderColor: "#d97706",
        borderWidth: 3,
      }),
      shapeNode({
        key: "end",
        x: 0,
        y: 320,
        width: 140,
        height: 70,
        content: "End",
        shapeType: "ellipse",
        backgroundColor: "#d1fae5",
        borderColor: "#059669",
        borderWidth: 3,
      }),
    ],
    edges: [
      { fromKey: "start", toKey: "p1", fromAnchor: "bottom", toAnchor: "top" },
      { fromKey: "start", toKey: "p2", fromAnchor: "bottom", toAnchor: "top" },
      { fromKey: "p1", toKey: "end", fromAnchor: "bottom", toAnchor: "top" },
      { fromKey: "p2", toKey: "end", fromAnchor: "bottom", toAnchor: "top" },
    ],
  },
};

export function getGraphTemplate(id: GraphTemplateId): GraphTemplateSpec {
  return graphTemplates[id];
}

export function listGraphTemplates(): Array<{ id: GraphTemplateId; name: string }> {
  return (Object.values(graphTemplates) as GraphTemplateSpec[]).map((t) => ({
    id: t.id,
    name: t.name,
  }));
}

export function templateNodeToCreateData(
  node: GraphTemplateNodeSpec,
  origin: { x: number; y: number }
): CreateBoardItemData {
  return {
    type: node.type,
    x: origin.x + node.x,
    y: origin.y + node.y,
    width: node.width,
    height: node.height,
    content: node.content,
    style: node.style,
    z_index: 0,
  };
}

