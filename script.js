const toggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navigation");
function closeNavigation() {
  navigation?.classList.remove("open");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Open navigation");
}
toggle?.addEventListener("click", () => {
  const open = navigation.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
});
navigation?.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeNavigation();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navigation?.classList.contains("open")) {
    closeNavigation();
    toggle.focus();
  }
});
