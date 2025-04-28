import render from "./render.js";

export default (vNode, $target) => {
  const $node = render(vNode);
  $target.replaceChildren($node);
};
