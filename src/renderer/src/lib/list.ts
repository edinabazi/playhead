export function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
  next.splice(adjustedIndex, 0, item);
  return next;
}

export function moveItemsBeforeOrAfter<T>(
  items: T[],
  itemsToMove: T[],
  targetItem: T,
  edge: "before" | "after" = "before",
): T[] {
  const movingSet = new Set(itemsToMove);
  if (movingSet.has(targetItem)) return items;

  const movingItems = items.filter((item) => movingSet.has(item));
  if (movingItems.length === 0) return items;

  const remainingItems = items.filter((item) => !movingSet.has(item));
  const targetIndex = remainingItems.indexOf(targetItem);
  if (targetIndex === -1) return items;

  const insertIndex = edge === "after" ? targetIndex + 1 : targetIndex;
  return [
    ...remainingItems.slice(0, insertIndex),
    ...movingItems,
    ...remainingItems.slice(insertIndex),
  ];
}
