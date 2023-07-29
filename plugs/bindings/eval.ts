import { ParseTree } from "$sb/lib/tree.ts";

function getNodeText(tree: ParseTree, document: string): string {
  return document.substring(tree.from || 0, tree.to);
}

export function evalExpression(
  tree: ParseTree,
  document: string,
): string | number {
  switch (tree.type) {
    case "Number":
      return Number.parseFloat(tree.text || getNodeText(tree, document));
    case "String":
      return tree.text!; // TODO actually handle strings
    default:
      throw new Error("cannot handle node type " + tree.type);
  }
}
