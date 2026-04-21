import type { AnchorSide } from "@/components/miro-v2/utils/connectorLayout";
import type { BoardItem, CreateBoardItemData } from "@/lib/api/miroApi";
import {
  getGraphTemplate,
  templateNodeToCreateData,
  type GraphTemplateId,
} from "./graphTemplates";

export interface InsertGraphTemplateResult {
  templateId: GraphTemplateId;
  rootItemId: string;
  createdItemIds: string[];
  createdByKey: Record<string, string>;
}

export async function insertGraphTemplate(params: {
  templateId: GraphTemplateId;
  origin: { x: number; y: number };
  createItem: (data: CreateBoardItemData) => Promise<BoardItem>;
}): Promise<InsertGraphTemplateResult> {
  const { templateId, origin, createItem } = params;
  const template = getGraphTemplate(templateId);

  const createdByKey: Record<string, string> = {};
  const createdItemIds: string[] = [];

  for (const node of template.nodes) {
    const created = await createItem(templateNodeToCreateData(node, origin));
    createdByKey[node.key] = created.id;
    createdItemIds.push(created.id);
  }

  const resolveKey = (key: string): string => {
    const id = createdByKey[key];
    if (!id) {
      throw new Error(`Template insertion failed: missing created id for key "${key}"`);
    }
    return id;
  };

  for (const edge of template.edges) {
    const fromItemId = resolveKey(edge.fromKey);
    const toItemId = resolveKey(edge.toKey);

    const created = await createItem({
      type: "connector",
      x: 0,
      y: 0,
      width: 120,
      height: 40,
      content: "",
      rotation: 0,
      style: {
        strokeColor: "#111827",
        strokeWidth: 4,
        connection: {
          fromItemId,
          toItemId,
          fromAnchor: edge.fromAnchor as AnchorSide,
          toAnchor: edge.toAnchor as AnchorSide,
        },
      },
      z_index: 0,
    });

    createdItemIds.push(created.id);
  }

  const rootItemId =
    createdByKey["root"] ?? createdByKey["start"] ?? createdItemIds[0] ?? "";
  if (!rootItemId) {
    throw new Error("Template insertion failed: no root item id");
  }

  return {
    templateId,
    rootItemId,
    createdItemIds,
    createdByKey,
  };
}

