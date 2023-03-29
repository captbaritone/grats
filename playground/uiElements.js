import { getUrlHash } from "./store.js";

export function bindStoreToUIElements(store) {
  const defaultNullableInput = document.getElementById("default-nullable");
  const showGratsDirectivesInput = document.getElementById(
    "show-grats-directives"
  );

  showGratsDirectivesInput.addEventListener("change", (e) => {
    store.dispatch({
      type: "SHOW_GRATS_DIRECTIVE_INPUT_CHANGED",
      value: e.target.checked,
    });
  });

  defaultNullableInput.addEventListener("change", (e) => {
    store.dispatch({
      type: "DEFAULT_NULLABLE_INPUT_CHANGED",
      value: e.target.checked,
    });
  });

  store.subscribe(() => {
    const state = store.getState();
    defaultNullableInput.checked = state.config.nullableByDefault;
    showGratsDirectivesInput.checked = state.view.showGratsDirectives;
  });

  const shareButton = document.getElementById("share-button");
  shareButton.addEventListener("click", async () => {
    try {
      const urlHash = getUrlHash(store.getState());
      const str = window.location.origin + window.location.pathname + urlHash;
      await navigator.clipboard.writeText(str);
      alert("Copied URL to clipboard.");
    } catch (err) {
      alert("Failed to copy URL to clipboard.");
    }
  });
}
