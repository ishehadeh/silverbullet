import { NodeWeakMap } from "@lezer/common";
import { Binding } from "../../common/bindings.ts";
import { EditorState, StateField, syntaxTree, Transaction } from "../deps.ts";

type BindingState = {
  bindings: NodeWeakMap<Binding>;
};

export function bindingsPlugin(
  bindings: Binding[],
): StateField<BindingState> {
  return StateField.define({
    create: (editor: EditorState): BindingState => {
      const bindingState: BindingState = { bindings: new NodeWeakMap() };
      const tree = syntaxTree(editor);
      for (const binding of bindings) {
        if (binding.location.index !== undefined) {
          bindingState.bindings.set(
            tree.resolveInner(binding.location.index),
            binding,
          );
        }
      }

      return bindingState;
    },
    update: (state: BindingState, txn: Transaction): BindingState => {
      if (!txn.docChanged) return state;

      // TODO: only iter changed ranges
      const cursor = syntaxTree(txn.state).cursor();
      while (cursor.next()) {
        const binding = state.bindings.cursorGet(cursor);
        if (binding) {
          console.log(
            binding,
            " => ",
            txn.newDoc.sliceString(cursor.node.from, cursor.node.to),
          );
        }
      }
      return state;
    },
  });
}
