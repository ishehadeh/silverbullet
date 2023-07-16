import { globToRegExp } from "https://deno.land/std@0.189.0/path/glob.ts";
import { SyntaxNode, SyntaxNodeRef } from "./deps.ts";

// testing out binding syntax:
//
// ```markdown
// - [ ] $[task:{{id}}.name ./!DueDate/**]
// ```
// This means “bind the name property of the object with ID {{id}} from the ‘task’ data source to the value of the current syntax node,
// and decendants (`**`), not including ‘DueDate’ syntax nodes.”

/// 2 ways to identify a binding's location:
///
/// By Index
/// ------------
/// Not ideal, should be used as briefly as possible to get the syntax node ref.
/// Used When:
///  - initially, before the document has been parsed.
///  - The syntax node has been deleted (index is set to the syntax node's last index), [TODO: would this work right?]
///
/// By Node
/// ------------
/// General way to match a binding. `node` and all of its decendants with paths matching pattern `syntaxPattern` are the binding's value.
export type BindingLocation = { index: number; node: undefined } | {
  node: SyntaxNodeRef;
  index: undefined;
};

export type Binding = {
  location: BindingLocation;

  objectSourceName: string;
  objectID: string; // integer IDs only right now, using a string for flexibility + precision
  objectPropertyPath: string;
  syntaxPattern: RegExp;
};

/// Awful, awful mini-templating language implementated with regex, basically.
export function findAndClearBindings(
  doc: string,
): [string, Binding[]] {
  // should probably make a grammar for these, using regex for prototype
  const BINDING_RE = /(?<!\\)\$\[([^\]]+)\]/gu;
  const BINDING_PATH_RE = /([a-z_][a-z0-9_]*):(\d+)(\.[a-z_][a-z0-9_]*)+/iu;

  const bindings = [];
  let newDoc = doc;
  let binding = null;
  while ((binding = BINDING_RE.exec(newDoc)) !== null) {
    try {
      const [objectPath, syntaxGlob] = binding[1].split(" ");
      const objectPathMatch = objectPath.match(BINDING_PATH_RE)!;
      // set OS to linux to always use '/' pathsep
      const syntaxPattern = globToRegExp(syntaxGlob, {
        extended: true,
        os: "linux",
        globstar: true,
      });
      // index is the index of the binding *after* preprocessing
      // since all prior bindings have been removed
      bindings.push({
        location: { index: binding.index!, node: undefined },
        objectSourceName: objectPathMatch[1],
        objectID: objectPathMatch[2],
        objectPropertyPath: objectPathMatch[3],
        syntaxPattern,
      });
    } catch (e) {
      throw new Error(`failed to parse binding '${binding}': ${e}`);
    }

    newDoc = newDoc.slice(0, binding.index!) +
      newDoc.slice(binding.index! + binding[0].length);
  }

  return [newDoc, bindings];
}
