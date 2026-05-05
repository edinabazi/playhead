import { describe, expect, it } from "vitest";
import { moveItem } from "../list";

describe("moveItem", () => {
  it("moves an item before a later target index", () => {
    expect(moveItem(["a", "b", "c", "d"], 1, 3)).toEqual(["a", "c", "b", "d"]);
  });

  it("moves an item before an earlier target index", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });
});
