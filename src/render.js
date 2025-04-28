const renderElem = ({ tagName, attrs, children }) => {
  const $el = document.createElement(tagName);

  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) {
      $el[k.toLowerCase()] = v; // مثال: onclick
    } else {
      $el.setAttribute(k, v);
    }
  }

  for (const child of children) {
    const $child = render(child);
    $el.appendChild($child);
  }

  return $el;
};

const render = (vNode) => {
  if (typeof vNode === "string") {
    return document.createTextNode(vNode);
  }

  return renderElem(vNode);
};

export default render