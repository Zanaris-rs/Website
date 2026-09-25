import { readFileSync } from "node:fs";

import { Reader } from "./server-obj.ts";

/**
 * The engine's param types (`data/pack/server/param.dat`), for looking a
 * param up by name. An object's params are packed by id
 * (`server-obj.ts`), and ids are handed out by the content's `param.pack`,
 * so the name is the stable thing to ask for.
 *
 * The file is a 2-byte count, then one opcode stream per param, each ended
 * by a 0 — the engine's `ParamType.decode`, every opcode of which is here.
 */

export type ParamType = {
  id: number;
  debugname: string | null;
  defaultInt: number | null;
};

export function readParamTypes(file: string): ParamType[] {
  const dat = new Reader(readFileSync(file));
  const count = dat.g2();
  const out: ParamType[] = [];
  for (let id = 0; id < count; id++) {
    const param: ParamType = { id, debugname: null, defaultInt: null };
    for (;;) {
      const code = dat.g1();
      if (code === 0) break;
      if (code === 1) dat.skip(1); // type
      else if (code === 2) param.defaultInt = dat.g4s();
      else if (code === 4) continue; // autodisable=no
      else if (code === 5) dat.skipString(); // default string
      else if (code === 250) param.debugname = dat.gjstr();
      else {
        throw new Error(
          `param ${id}: unknown config opcode ${code} in server/param.dat; ` +
            `the pack is from an engine this reader does not match`,
        );
      }
    }
    out.push(param);
  }
  return out;
}

/** One param by name, or an error naming the pack: the build cannot guess. */
export function paramNamed(params: readonly ParamType[], name: string): ParamType {
  const param = params.find((p) => p.debugname === name);
  if (!param) {
    throw new Error(`server/param.dat has no param named ${name}; repack the engine`);
  }
  return param;
}
