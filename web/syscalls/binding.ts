import type { SysCallMapping } from "../../plugos/system.ts";
import { Client } from "../client.ts";

export function sandboxFetchSyscalls(editor: Client): SysCallMapping {
  return {
    "binding.set": async (
      object: string,
      start: number,
      end: number,
    ): Promise<void> => {
      // TODO
    },
  };
}
