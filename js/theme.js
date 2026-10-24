// Apply the saved/system theme before styles paint. No Firebase or network dependency.
(() => {
  const key = "ful-theme";
  const system = matchMedia("(prefers-color-scheme: dark)");
  let preference;
  try {
    preference = localStorage.getItem(key);
  } catch {
    /* private browsing */
  }
  const valid = (value) => value === "dark" || value === "light";
  const root = document.documentElement;
  let button;
  const sun =
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
  const moon = '<path d="M20.5 14.3A9 9 0 0 1 9.7 3.5 9 9 0 1 0 20.5 14.3Z"/>';
  function apply() {
    const theme = valid(preference)
      ? preference
      : system.matches
        ? "dark"
        : "light";
    root.dataset.theme = theme;
    if (button) {
      const label =
        "Switch to " + (theme === "dark" ? "light" : "dark") + " mode";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.innerHTML =
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
        (theme === "dark" ? sun : moon) +
        "</svg>";
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#101823" : "#49618D");
  }
  apply();
  document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".site-header .header-inner");
    if (!header) return;
    button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button theme-toggle";
    button.addEventListener("click", () => {
      preference = root.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(key, preference);
      } catch {
        /* theme still works without storage */
      }
      apply();
    });
    header.append(button);
    apply();
  });
  system.addEventListener("change", () => {
    if (!valid(preference)) apply();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      preference = event.newValue;
      apply();
    }
  });
})();
