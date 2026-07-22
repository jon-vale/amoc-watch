export function validateObservation(record) {
  const required = ["source", "variable", "family", "date", "value", "units", "quality"];
  for (const field of required) if (!(field in record)) throw new Error(`Observation missing ${field}`);
  if (!/^\d{4}-\d{2}$/.test(record.date)) throw new Error("Observation date must be YYYY-MM");
  if (!Number.isFinite(record.value)) throw new Error("Observation value must be finite");
  return record;
}

export function normalizeObservation(record) {
  return validateObservation({
    ...record,
    retrievedAt: record.retrievedAt ?? new Date().toISOString(),
    provisional: Boolean(record.provisional),
    revision: record.revision ?? "unknown",
  });
}
