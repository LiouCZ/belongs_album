const stampOrder = ["gold", "antique"];
const positions = ["top-right", "top-left", "bottom-right", "bottom-left"];

export function coverStampMetadata(entry) {
  const stamps = entry.coverStamps === undefined ? [] : entry.coverStamps;
  if (!Array.isArray(stamps) || stamps.some((stamp) => !stampOrder.includes(stamp)) || new Set(stamps).size !== stamps.length) {
    throw new Error(`Invalid cover stamps: ${entry.id}`);
  }
  if (entry.coverStampPosition !== undefined && !positions.includes(entry.coverStampPosition)) {
    throw new Error(`Invalid cover stamp position: ${entry.id}`);
  }
  if (!stamps.length) return {};
  return {
    coverStamps: stampOrder.filter((stamp) => stamps.includes(stamp)),
    ...(entry.coverStampPosition === undefined ? {} : { coverStampPosition: entry.coverStampPosition }),
  };
}
