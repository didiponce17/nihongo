const validRoutes = new Set([
  "home", "study", "review", "flashcards", "kana", "kanji", "grammar",
  "writing", "quiz", "exam", "errors", "progress", "import", "settings",
]);

export function currentRoute() {
  const route = location.hash.replace(/^#\//, "").split("/")[0] || "home";
  return validRoutes.has(route) ? route : "home";
}

export function startRouter(render) {
  const update = () => {
    const route = currentRoute();
    document.querySelectorAll("[data-route]").forEach((link) => {
      if (link.dataset.route === route) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    render(route);
  };
  window.addEventListener("hashchange", update);
  if (!location.hash) history.replaceState(null, "", "#/home");
  update();
}