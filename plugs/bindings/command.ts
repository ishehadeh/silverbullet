import { findNodeOfType } from "$sb/lib/tree.ts";
import { editor, markdown } from "$sb/silverbullet-syscall/mod.ts";
import { traverseTree } from "$sb/lib/tree.ts";
import { evalExpression } from "./eval.ts";

export async function updateBindingsOnPage() {
  const text = await editor.getText();
  const tree = await markdown.parseMarkdown(text);

  traverseTree(tree, (tree) => {
    if (tree.type !== "Binding") {
      return false;
    }
    let expr = findNodeOfType(tree, "BindingExpression");
    let value = findNodeOfType(tree, "BindingValue");
    if (!expr || !value) {
      return false;
    }

    let exprTop = expr.children![0].children![0]!;
    let result = evalExpression(exprTop, text);
    console.log(`EVAL ${result}`);
    return false;
  });

  await editor.save();
}
