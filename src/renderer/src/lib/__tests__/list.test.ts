import { describe, expect, it } from "vitest";
import { moveItem, moveItemsBeforeOrAfter } from "../list";

describe("moveItem", () => {
  it("moves an item before a later target index", () => {
    expect(moveItem(["a", "b", "c", "d"], 1, 3)).toEqual(["a", "c", "b", "d"]);
  });

  it("moves an item before an earlier target index", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });
});

describe("moveItemsBeforeOrAfter", () => {
  it("moves multiple items before a target as one ordered block", () => {
    expect(moveItemsBeforeOrAfter(["a", "b", "c", "d", "e"], ["b", "d"], "e")).toEqual([
      "a",
      "c",
      "b",
      "d",
      "e",
    ]);
  });

  it("moves multiple items after a target as one ordered block", () => {
    expect(moveItemsBeforeOrAfter(["a", "b", "c", "d", "e"], ["b", "d"], "a", "after")).toEqual([
      "a",
      "b",
      "d",
      "c",
      "e",
    ]);
  });

  it("does nothing when the target is part of the moved block", () => {
    expect(moveItemsBeforeOrAfter(["a", "b", "c"], ["a", "b"], "b")).toEqual(["a", "b", "c"]);
  });
});
