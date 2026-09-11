function scanFields() {
  const fields = [];

  document.querySelectorAll("input, textarea, select").forEach((element) => {
    const label = getFieldLabel(element);

    fields.push({
      tag: element.tagName.toLowerCase(),
      type: element.type || null,
      name: element.name || null,
      id: element.id || null,
      placeholder: element.placeholder || null,
      label,
      value: element.value || "",
      required: element.required
    });
  });

  return fields;
}

function getFieldLabel(element) {
  const id = element.id;

  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.innerText.trim();
  }

  const parentLabel = element.closest("label");
  if (parentLabel) return parentLabel.innerText.trim();

  return element.getAttribute("aria-label") || "";
}