export function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.style) node.setAttribute("style", options.style);
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.attributes) {
    for (const [name, value] of Object.entries(options.attributes)) node.setAttribute(name, String(value));
  }
  for (const child of options.children ?? []) node.append(child);
  return node;
}

export function icon(name) {
  return element("i", { attributes: { "data-lucide": name, "aria-hidden": "true" } });
}