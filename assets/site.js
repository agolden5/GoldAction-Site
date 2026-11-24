"use strict";

const menu = document.querySelector("#site-menu");
const navigation = document.querySelector("#site-navigation");
const narrow = window.matchMedia("(max-width: 50rem)");

function setMenu(open) {
  menu.setAttribute("aria-expanded", String(open));
  menu.textContent = open ? "Close" : "Menu";
  navigation.hidden = narrow.matches && !open;
}

if (menu && navigation) {
  function updateNavigation() {
    if (!narrow.matches && document.activeElement === menu) {
      navigation.hidden = false;
      navigation.querySelector("a").focus();
    }
    menu.hidden = !narrow.matches;
    setMenu(narrow.matches && navigation.contains(document.activeElement));
  }

  menu.addEventListener("click", () => {
    setMenu(menu.getAttribute("aria-expanded") === "false");
  });
  navigation.addEventListener("click", (event) => {
    if (narrow.matches && event.target.closest('a[href^="/#"]') && location.pathname === "/") {
      const section = document.getElementById(event.target.closest("a").hash.slice(1));
      if (section) {
        section.setAttribute("tabindex", "-1");
        section.focus({ preventScroll: true });
      }
      setMenu(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      menu.focus();
    }
  });
  narrow.addEventListener("change", updateNavigation);
  updateNavigation();
}

const explorer = document.querySelector("#explorer-controls");
if (explorer) {
  const scenes = document.querySelectorAll("[data-workflow]");
  const buttons = document.querySelector(".explorer-buttons");
  const back = document.querySelector("#workflow-back");
  const next = document.querySelector("#workflow-next");
  const stages = [...explorer.elements.stage].map((input) => input.value);

  function showWorkflowStep() {
    const workflow = explorer.elements.workflow.value;
    const stage = explorer.elements.stage.value;
    for (const scene of scenes) {
      scene.hidden = scene.dataset.workflow !== workflow;
      for (const detail of scene.querySelectorAll("[data-stage]")) {
        detail.hidden = detail.dataset.stage !== stage;
      }
    }
    back.setAttribute("aria-disabled", String(stage === stages[0]));
    next.setAttribute("aria-disabled", String(stage === stages.at(-1)));
  }

  explorer.addEventListener("change", (event) => {
    if (event.target.name === "workflow") explorer.elements.stage.value = stages[0];
    showWorkflowStep();
  });

  function moveStep(offset) {
    const target = stages[stages.indexOf(explorer.elements.stage.value) + offset];
    if (target === undefined) return;
    explorer.elements.stage.value = target;
    showWorkflowStep();
  }

  back.addEventListener("click", () => moveStep(-1));
  next.addEventListener("click", () => moveStep(1));
  showWorkflowStep();
  explorer.hidden = false;
  buttons.hidden = false;
}

const brief = document.querySelector("#brief-controls");
if (brief) {
  const output = document.querySelector("#brief-text");
  const copy = document.querySelector("#copy-brief");
  const status = document.querySelector("#brief-status");
  const localNotice = status.textContent;

  brief.addEventListener("change", () => {
    const workflow = brief.elements.workflow.selectedOptions[0].textContent;
    const checkpoint = brief.elements.checkpoint.selectedOptions[0].textContent.toLowerCase();
    output.value = `Workshop goal: ${workflow}. Use fictional examples to test the first draft. A teammate will ${checkpoint}.`;
    status.textContent = `Brief updated. ${localNotice}`;
  });

  copy.addEventListener("click", async () => {
    const text = output.value;
    try {
      await navigator.clipboard.writeText(text);
      if (output.value === text) status.textContent = "Brief copied.";
    } catch {
      output.focus();
      output.select();
      status.textContent = "Brief selected. Copy it with your device’s copy command.";
    }
  });

  brief.hidden = false;
  copy.hidden = false;
}
