/**
 * The one part of bun's runtime API the scene build's plugins use, typed
 * here because this repository has no bun types (`tsc` checks `scripts/`
 * like everything else, and nothing else needs them).
 *
 * A runtime plugin's `onLoad` replaces a module's source as it is imported,
 * for every import after it is registered. Only `.ts` modules are rewritten
 * here, so `loader` is always "ts".
 */

type OnLoad = (args: { path: string }) => { contents: string; loader: "ts" };

export type BunPlugin = {
  name: string;
  setup(build: { onLoad(options: { filter: RegExp }, callback: OnLoad): void }): void;
};

export function bunPlugin(plugin: BunPlugin): void {
  const { Bun } = globalThis as { Bun?: { plugin(plugin: BunPlugin): void } };
  if (!Bun) {
    throw new Error(
      `${plugin.name} is a bun plugin: run the scene build with bun, through scripts/update-scenes.sh`,
    );
  }
  Bun.plugin(plugin);
}
