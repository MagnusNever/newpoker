export function getShowdownRevealState<T>(orderedEntries: T[], revealStep: number) {
  const clampedStep = Math.max(0, Math.min(revealStep, orderedEntries.length + 1));
  const isFinalRanking = clampedStep > orderedEntries.length;
  return {
    isFinalRanking,
    visibleEntries: isFinalRanking ? orderedEntries : orderedEntries.slice(0, clampedStep),
    revealedCount: Math.min(clampedStep, orderedEntries.length),
    revealTotal: orderedEntries.length,
  };
}
