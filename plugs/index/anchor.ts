import { collectNodesOfType } from "$sb/lib/tree.ts";
import type { CompleteEvent, IndexTreeEvent } from "$sb/app_event.ts";
import { removeQueries } from "$sb/lib/query.ts";
import { ObjectValue } from "$sb/types.ts";
import { indexObjects, queryObjects } from "./api.ts";

type AnchorObject = ObjectValue<{
  name: string;
  page: string;
  pos: number;
}>;

export async function indexAnchors({ name: pageName, tree }: IndexTreeEvent) {
  removeQueries(tree);
  const anchors: ObjectValue<AnchorObject>[] = [];

  collectNodesOfType(tree, "NamedAnchor").forEach((n) => {
    const aName = n.children![0].text!.substring(1);
    anchors.push({
      ref: `${pageName}@${aName}`,
      tags: ["anchor"],
      name: aName,
      page: pageName,
      pos: n.from!,
    });
  });
  // console.log("Found", anchors.length, "anchors(s)");
  await indexObjects(pageName, anchors);
}

export async function anchorComplete(completeEvent: CompleteEvent) {
  const match = /\[\[([^\]@:]*@[\w\.\-\/]*)$/.exec(completeEvent.linePrefix);
  if (!match) {
    return null;
  }

  let [pageRef, anchorRef] = match[1].split("@");
  if (!pageRef) {
    pageRef = completeEvent.pageName;
  }
  const allAnchors = await queryObjects<AnchorObject>("anchor", {
    filter: ["=", ["attr", "page"], ["string", pageRef]],
  });
  return {
    from: completeEvent.pos - anchorRef.length,
    options: allAnchors.map((a) => ({
      label: a.name,
      type: "anchor",
    })),
  };
}
