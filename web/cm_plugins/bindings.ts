import { Binding } from "../../common/bindings.ts";
import { EditorState, StateField, Transaction } from "../deps.ts";

type BindingState = {
  bindings: Binding[];
};

export function bindingsPlugin(
  bindings: Binding[],
): StateField<BindingState> {
  return StateField.define({
    create: (_editor: EditorState): BindingState => {
      const bindingState: BindingState = { bindings };
      return bindingState;
    },
    update: (state: BindingState, txn: Transaction): BindingState => {
      if (!txn.docChanged) return state;

      for (const binding of state.bindings) {
        if (
          txn.changes.touchesRange(
            binding.location.start - 1,
            binding.location.end + 1,
          ) === true
        ) {
          console.log(
            `${binding.objectSourceName}[${binding.objectID}]${binding.objectPropertyPath} updated`,
          );
        }
      }

      return state;
    },
  });
}
