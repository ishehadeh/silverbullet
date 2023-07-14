import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import { findBindings } from "./bindings.ts";

Deno.test("Path functions", () => {
  const [binding] = findBindings("hello $[a:1.b ./*]");
  assertEquals(binding.objectSourceName, "a");
  assertEquals(binding.objectID, "1");
  assertEquals(binding.objectPropertyPath, ".b");
});
