import { describe, expect, it } from "vitest";

import { type GenealogyNode, buildGenealogy } from "./genealogy";
import type { GenealogyRow } from "./queries";

function row(
  citizenNumber: number,
  invitedBy: number | null,
  joinedAt = `2026-09-${String(citizenNumber).padStart(2, "0")}T00:00:00.000Z`,
): GenealogyRow {
  return {
    username: `p${citizenNumber}`,
    citizenNumber,
    invitedBy,
    joinedAt,
    invitesEnabled: false,
    banned: false,
  };
}

/** `1(2(4),3)` — the shape of a forest, for comparing whole trees at once. */
function shape(nodes: readonly GenealogyNode[]): string {
  return nodes
    .map((node) =>
      node.children.length === 0
        ? String(node.citizenNumber)
        : `${node.citizenNumber}(${shape(node.children)})`,
    )
    .join(",");
}

describe("buildGenealogy", () => {
  it("puts the progenitors at the top, oldest citizen first", () => {
    const tree = buildGenealogy([row(5, null), row(1, null), row(3, null)]);
    expect(shape(tree)).toBe("1,3,5");
  });

  it("hangs each account under the one that let it in", () => {
    const tree = buildGenealogy([
      row(1, null),
      row(2, null),
      row(3, 1),
      row(4, 3),
      row(5, 2),
      row(6, 3),
    ]);
    expect(shape(tree)).toBe("1(3(4,6)),2(5)");
  });

  it("orders brothers and sisters by when they joined, not by number", () => {
    const tree = buildGenealogy([
      row(1, null),
      row(2, 1, "2026-09-20T00:00:00.000Z"),
      row(3, 1, "2026-09-10T00:00:00.000Z"),
    ]);
    expect(shape(tree)).toBe("1(3,2)");
  });

  it("counts everybody below an account, at every depth", () => {
    const [root] = buildGenealogy([row(1, null), row(2, 1), row(3, 2), row(4, 2), row(5, 1)]);
    expect(root.descendants).toBe(4);
    expect(root.children[0].descendants).toBe(2);
    expect(root.children[1].descendants).toBe(0);
  });

  it("makes an account whose inviter is missing a root rather than dropping it", () => {
    const tree = buildGenealogy([row(1, null), row(7, 99)]);
    expect(shape(tree)).toBe("1,7");
  });

  it("keeps every member of a loop on the page", () => {
    // The database cannot make one; if it ever did, nobody may vanish.
    const tree = buildGenealogy([row(1, null), row(2, 3), row(3, 2), row(4, 4)]);
    const seen: number[] = [];
    const visit = (nodes: readonly GenealogyNode[]) =>
      nodes.forEach((node) => {
        seen.push(node.citizenNumber);
        visit(node.children);
      });
    visit(tree);
    expect(seen.sort()).toEqual([1, 2, 3, 4]);
  });

  it("answers an empty list with an empty tree", () => {
    expect(buildGenealogy([])).toEqual([]);
  });
});
