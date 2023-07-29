import { findNodeOfType } from "$sb/lib/tree.ts";
import { editor, markdown } from "$sb/silverbullet-syscall/mod.ts";
import { traverseTree } from "$sb/lib/tree.ts";
import { evalExpression } from "./eval.ts";

export async function updateBindingsOnPage() {
  const text = await editor.getText();
  const tree = await markdown.parseMarkdown(text);
  let replacements: { from: number; to: number; insert: string }[] = [];
  traverseTree(tree, (tree) => {
    if (tree.type !== "Binding") {
      return false;
    }
    const expr = findNodeOfType(tree, "BindingExpression");
    const value = findNodeOfType(tree, "BindingValue");
    if (!expr || !value) {
      return false;
    }

    const exprTop = expr.children![0].children![0]!;
    const result = evalExpression(exprTop, text);

    replacements.push({
      from: value.from!,
      to: value.to!,
      insert: `${result}`,
    });
    return false;
  });

  // from directive/command.ts:
  // Iterate again and replace the bodies. Iterating again (not using previous positions)
  // because text may have changed in the mean time (directive processing may take some time)
  // Hypothetically in the mean time directives in text may have been changed/swapped, in which
  // case this will break. This would be a rare edge case, however.
  for (const { from, to, insert } of replacements) {
    // Fetch the text every time, because dispatch() will have been made changes
    const text = await editor.getText();

    if (text.substring(from, to) === insert) {
      // No change, skip
      continue;
    }
    await editor.dispatch({
      changes: {
        from,
        to,
        insert,
      },
    });
  }

  await editor.save();
}
