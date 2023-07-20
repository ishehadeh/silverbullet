import { globToRegExp } from "https://deno.land/std@0.189.0/path/glob.ts";

export type BindingLocation = {
  start: number;
  end: number;
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

  const bindings: Binding[] = [];
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
        location: { start: binding.index!, end: binding.index! },
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
