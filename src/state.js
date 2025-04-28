let stateRef;
let reRenderCallback;

export function initState(state, reRender) {
  stateRef = state;
  reRenderCallback = reRender;
}

export function setState(newState) {
  if (!stateRef) {
    throw new Error("State is not initialized.");
  }
  Object.assign(stateRef, newState);
  reRenderCallback();
}
export { stateRef as state };
