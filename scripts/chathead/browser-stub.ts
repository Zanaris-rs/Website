/**
 * The reference pictures are drawn by the client's own `ClientPlayer`, and
 * importing it imports the whole client: its audio and its soundfont loader
 * set themselves up on `window` and `document` and fetch files the moment
 * they are evaluated. None of that is used to build a head, so under bun it
 * only has to survive being loaded. Everything here answers any property,
 * call or `new` with itself, and `fetch` never settles, so the soundfont
 * request neither fails nor leaves a rejection to crash the process.
 *
 * Only `scripts/chathead/build.ts` loads this, and it must be the first
 * import there: ES modules evaluate in import order. It is not in the
 * renderer the site ships, which is only `Model`, `Pix3D` and `Pix2D`.
 */

const anything: unknown = new Proxy(function () {}, {
  get: (_target, key) =>
    key === Symbol.toPrimitive ? () => 0 : anything,
  apply: () => anything,
  construct: () => anything as object,
});

const scope = globalThis as unknown as Record<string, unknown>;
scope.window = anything;
scope.document = anything;
scope.localStorage = anything;
scope.navigator ??= anything;
scope.fetch = () => new Promise(() => {});

export {};
