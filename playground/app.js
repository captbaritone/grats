import store from "./store";

import { bindStoreToUrl } from "./urlState.js";
import { bindStoreToUIElements } from "./uiElements";
import { createOutputView } from "./editors/outputView";
import { createInputView } from "./editors/inputView";

async function main() {
  bindStoreToUIElements(store);
  bindStoreToUrl(store);
  await createInputView(store);
  createOutputView(store);
}

main();
