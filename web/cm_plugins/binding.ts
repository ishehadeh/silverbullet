import { Decoration, syntaxTree } from "../deps.ts";
import {
  decoratorStateField,
  invisibleDecoration,
  isCursorInRange,
} from "./util.ts";

export function bindingPlugin() {
  return decoratorStateField((state) => {
    const widgets: any[] = [];

    syntaxTree(state).iterate({
      enter: ({ type, from, to, node }) => {
        if (type.name !== "Binding") {
          return;
        }

        if (isCursorInRange(state, [from, to])) {
          return;
        }

        const exprPart = node.getChild("BindingExpression");
        const valuePart = node.getChild("BindingValue");

        if (!exprPart || !valuePart) {
          return;
        }

        // Hide the expression
        widgets.push(
          invisibleDecoration.range(
            exprPart.from - 2, // TODO: find the actual child mark
            exprPart.to + 2,
          ),
        );

        // hide the ending ")"
        widgets.push(invisibleDecoration.range(
          valuePart.to, // TODO: find the actual child mark
          valuePart.to + 1,
        ));
      },
    });

    return Decoration.set(widgets, true);
  });
}
