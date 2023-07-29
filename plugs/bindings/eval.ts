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
      return tree.text || getNodeText(tree, document); // TODO actually handle strings
    case "InfixExpr": {
      const [lhsTree, opNode, rhsTree] = tree.children!.filter((n) => !!n.type);
      console.log(tree.children!);
      const lhs: any = evalExpression(lhsTree, document);
      const rhs: any = evalExpression(rhsTree, document);
      switch (opNode.type) {
        case "OpAdd":
          if (
            typeof lhs != typeof rhs
          ) {
            throw new Error(
              `TypeError: cannot add ${typeof lhs} and ${typeof rhs}`,
            );
          }

          return lhs + rhs;
        default:
          throw new Error("unknown op " + opNode.type);
      }
    }
    default:
      throw new Error("cannot handle node type " + tree.type);
  }
}
