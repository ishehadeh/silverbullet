import { assertEquals } from "https://deno.land/std@0.165.0/testing/asserts.ts";
import { findAndClearBindings } from "./bindings.ts";

Deno.test("Path functions", () => {
  const [newDoc, [binding]] = findAndClearBindings("hello $[a:1.b ./*]");
  assertEquals(newDoc, "hello ");
  assertEquals(binding.objectSourceName, "a");
  assertEquals(binding.objectID, "1");
  assertEquals(binding.objectPropertyPath, ".b");
});
