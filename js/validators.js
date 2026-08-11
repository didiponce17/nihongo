const MAX_DOCUMENT_BYTES = 2_000_000;

export async function loadJson(relativePath) {
  const response = await fetch(relativePath, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`No se pudo cargar ${relativePath} (${response.status}).`);
  const text = await response.text();
  if (text.length > MAX_DOCUMENT_BYTES) throw new Error(`${relativePath} supera el límite de carga de la aplicación.`);
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${relativePath} no contiene un objeto JSON válido.`);
  if (typeof value.schemaVersion !== "string") throw new Error(`${relativePath} no declara schemaVersion.`);
  return value;
}

export function onlyPublished(items, policy) {
  const statuses = new Set(policy.publication.publishedStatuses);
  return items.filter((item) => statuses.has(item.validationStatus));
}