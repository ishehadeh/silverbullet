import { globToRegExp } from "https://deno.land/std@0.189.0/path/glob.ts";

// testing out binding syntax:
//
// ```markdown
// - [ ] $[task:{{id}}.name ./!DueDate/**]
// ```
// This means “bind the name property of the object with ID {{id}} from the ‘task’ data source to the value of the current syntax node,
// and decendants (`**`), not including ‘DueDate’ syntax nodes.”

type Binding = {
  objectSourceName: string;
  objectID: string; // integer IDs only right now, using a string for flexibility + precision
  objectPropertyPath: string;
  syntaxPattern: RegExp;
};

export function* findBindings(doc: string): Generator<Binding> {
  // should probably make a grammar for these, using regex for prototype
  const BINDING_RE = /(?<!\\)\$\[([^\]]+)\]/gu;
  const BINDING_PATH_RE = /([a-z_][a-z0-9_]*):(\d+)(\.[a-z_][a-z0-9_]*)+/iu;

  for (const binding of doc.matchAll(BINDING_RE)) {
    try {
      const [objectPath, syntaxGlob] = binding[1].split(" ");
      const objectPathMatch = objectPath.match(BINDING_PATH_RE)!;
      // set OS to linux to always use '/' pathsep
      const syntaxPattern = globToRegExp(syntaxGlob, {
        extended: true,
        os: "linux",
        globstar: true,
      });

      yield {
        objectSourceName: objectPathMatch[1],
        objectID: objectPathMatch[2],
        objectPropertyPath: objectPathMatch[3],
        syntaxPattern,
      };
    } catch (e) {
      throw new Error(`failed to parse binding '${binding}': ${e}`);
    }
  }
}
