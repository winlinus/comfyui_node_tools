import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// The whole editor lives inside one DOM element handed to `node.addDOMWidget`.
// ComfyUI owns its position, clipping, collapse and zoom from that point on —
// which is why there is no z-index juggling and no visibility watchdog here.
// See docs/adr/0003-ui-hosted-by-addDOMWidget.md

const STATE_VERSION = 1;
const DEFAULT_BLOCK_NAMES = ["品質", "角色", "人數", "體型", "髮", "服裝", "動作", "場景"];
const WEIGHT_RE = /^\((.+):([0-9]*\.?[0-9]+)\)$/;
// Bounded because a single wheel flick travels a long way, and on Illustrious
// anything past ~1.5 is already burnt.
const WEIGHT_MIN = 0.1;
const WEIGHT_MAX = 2.0;
const WEIGHT_STEP = 0.1;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styleElement = document.createElement("style");
styleElement.textContent = `
    .pe-root {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 4px;
        font-size: 12px;
        color: var(--fg-color);
        box-sizing: border-box;
        /* One scrollbar for the whole editor. This also makes .pe-root a
           clipping boundary, which is why dropdowns flip up when they'd
           otherwise open past its bottom edge — see placeDropdown(). */
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .pe-block {
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background-color: var(--comfy-input-bg);
        overflow: visible;
    }

    .pe-block.disabled .pe-chips,
    .pe-block.disabled .pe-block-name {
        opacity: 0.4;
    }

    .pe-block-header {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 3px 4px;
        background: rgba(255, 255, 255, 0.04);
        border-bottom: 1px solid var(--border-color);
    }

    .pe-toggle {
        cursor: pointer;
        width: 16px;
        height: 16px;
        line-height: 16px;
        text-align: center;
        border-radius: 3px;
        flex-shrink: 0;
        user-select: none;
    }
    .pe-toggle:hover { background: rgba(255, 255, 255, 0.1); }

    .pe-block-name {
        flex-grow: 1;
        min-width: 40px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 3px;
        color: var(--fg-color);
        font-size: 12px;
        font-weight: bold;
        outline: none;
        padding: 1px 4px;
    }
    .pe-block-name:hover { border-color: var(--border-color); }
    .pe-block-name:focus { border-color: var(--primary-color, #2a81f6); background: var(--comfy-menu-bg); }

    .pe-block-btn {
        cursor: pointer;
        color: #888;
        width: 16px;
        height: 16px;
        line-height: 15px;
        text-align: center;
        border-radius: 3px;
        flex-shrink: 0;
        user-select: none;
    }
    .pe-block-btn:hover { color: var(--fg-color); background: rgba(255, 255, 255, 0.12); }
    .pe-block-btn.danger:hover { color: #ff5555; background: rgba(255, 0, 0, 0.12); }
    .pe-block-btn.disabled { opacity: 0.25; pointer-events: none; }

    .pe-chips {
        position: relative;
        min-height: 28px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        align-items: center;
        padding: 4px;
        cursor: text;
    }

    .pe-chip {
        background-color: var(--comfy-menu-bg);
        color: var(--fg-color);
        padding: 2px 8px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: grab;
        user-select: none;
        border: 1px solid var(--border-color);
        transition: transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.15s;
    }
    .pe-chip:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .pe-chip:active { cursor: grabbing; transform: scale(0.98); box-shadow: none; }
    .pe-chip.dragging { opacity: 0.4; }
    .pe-chip .zh { opacity: 0.6; font-size: 0.9em; }

    .pe-chip-remove { cursor: pointer; font-weight: bold; color: #ff6b6b; }
    .pe-chip-remove:hover { color: #ff0000; }

    /* Always present, but quiet until you look at the chip. Hidden-on-hover
       would be tidier and just as undiscoverable as Shift+wheel already was. */
    .pe-weight { display: flex; align-items: center; gap: 1px; }
    .pe-weight-btn {
        cursor: pointer;
        opacity: 0.3;
        padding: 0 2px;
        font-weight: bold;
        line-height: 1;
        user-select: none;
    }
    .pe-chip:hover .pe-weight-btn { opacity: 0.75; }
    .pe-weight-btn:hover { opacity: 1; color: var(--primary-color, #2a81f6); }
    .pe-weight-val {
        display: none;
        cursor: pointer;
        opacity: 0.85;
        min-width: 20px;
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
    .pe-weight.active .pe-weight-val { display: inline; }
    .pe-weight-val:hover { color: var(--primary-color, #2a81f6); }

    .pe-chip-edit {
        border: none; outline: none; background: transparent;
        color: inherit; font: inherit; padding: 0; min-width: 30px;
    }

    .pe-input {
        flex-grow: 1;
        min-width: 70px;
        background: transparent;
        border: none;
        color: var(--fg-color);
        outline: none;
        font-size: 12px;
        padding: 2px;
    }

    .pe-placeholder {
        width: 50px;
        height: 20px;
        background-color: rgba(255, 255, 255, 0.06);
        border: 1px dashed var(--primary-color, #2a81f6);
        border-radius: 12px;
        pointer-events: none;
        flex-shrink: 0;
    }

    .pe-footer {
        position: relative;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .pe-add-block {
        flex-grow: 1;
        border: 1px dashed var(--border-color);
        border-radius: 4px;
        padding: 4px;
        text-align: center;
        cursor: pointer;
        color: #888;
        user-select: none;
    }
    .pe-add-block:hover { color: var(--primary-color, #2a81f6); border-color: var(--primary-color, #2a81f6); }

    /* Dropdowns anchored inside a block. They only need to sit above sibling
       blocks, so a small local stacking value is enough. */
    .pe-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        min-width: 200px;
        max-height: 200px;
        overflow-y: auto;
        background-color: var(--comfy-menu-bg);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        display: none;
        flex-direction: column;
        z-index: 1;
    }

    .pe-dropdown-item {
        padding: 4px 10px;
        cursor: pointer;
        color: var(--fg-color);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
    }
    .pe-dropdown-item:last-child { border-bottom: none; }
    .pe-dropdown-item:hover, .pe-dropdown-item.selected {
        background-color: var(--primary-color, #2a81f6);
        color: white;
    }
    .pe-dropdown-item.action { font-weight: bold; color: var(--primary-color, #2a81f6); }
    .pe-dropdown-item.action:hover { color: white; }
    .pe-dropdown-item.empty { font-style: italic; opacity: 0.6; cursor: default; }
    .pe-dropdown-item .cat { opacity: 0.5; font-size: 0.8em; }
    .pe-template-delete { color: #ff6b6b; font-weight: bold; padding: 0 4px; border-radius: 3px; }
    .pe-template-delete:hover { background: rgba(255, 0, 0, 0.15); color: #ff0000; }

    /* Modal is deliberately a document-level overlay, so it does carry a high
       stacking value — that is what a modal is for. */
    .pe-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 20000;
        display: flex; justify-content: center; align-items: center;
    }
    .pe-modal {
        background: var(--comfy-menu-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 20px;
        min-width: 300px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        display: flex; flex-direction: column; gap: 15px;
        color: var(--fg-color);
    }
    .pe-modal-title { font-weight: bold; font-size: 14px; }
    .pe-modal label { font-size: 12px; color: #aaa; display: block; margin-bottom: 4px; }
    .pe-modal input {
        background: var(--comfy-input-bg);
        border: 1px solid var(--border-color);
        color: var(--fg-color);
        border-radius: 4px; padding: 8px; outline: none; width: 100%;
        box-sizing: border-box;
    }
    .pe-modal input:focus { border-color: var(--primary-color, #2a81f6); }
    .pe-modal-buttons { display: flex; justify-content: flex-end; gap: 10px; }
    .pe-modal-btn { padding: 5px 15px; border-radius: 4px; cursor: pointer; font-size: 12px; border: none; }
    .pe-modal-btn.cancel { background: var(--comfy-input-bg); color: var(--fg-color); }
    .pe-modal-btn.confirm { background: var(--primary-color, #2a81f6); color: white; }
    .pe-modal-btn:hover { opacity: 0.9; }
`;
document.head.appendChild(styleElement);

console.log("Loading PromptEditor extension...");

// ---------------------------------------------------------------------------
// Tag library
// ---------------------------------------------------------------------------

let availableTags = [];
const tagsByEn = new Map();
const tagsPath = new URL("./tags.json", import.meta.url).href;

fetch(tagsPath)
    .then((response) => response.json())
    .then((data) => {
        availableTags = data;
        for (const tag of data) tagsByEn.set(tag.en, tag);
        console.log(`Loaded ${availableTags.length} tags for autocomplete.`);
    })
    .catch((err) => console.error("Failed to load tags.json:", err));

// ---------------------------------------------------------------------------
// Only one dropdown open at a time
// ---------------------------------------------------------------------------

let openDropdown = null;
function closeOpenDropdown() {
    if (openDropdown) {
        openDropdown.close();
        openDropdown = null;
    }
}
document.addEventListener("click", (e) => {
    if (openDropdown && !openDropdown.element.contains(e.target) && e.target !== openDropdown.trigger) {
        closeOpenDropdown();
    }
});

// ---------------------------------------------------------------------------
// Chip helpers
// ---------------------------------------------------------------------------

function splitWeight(text) {
    const m = text.match(WEIGHT_RE);
    return m ? { base: m[1], weight: parseFloat(m[2]) } : { base: text, weight: 1 };
}

function joinWeight(base, weight) {
    return weight === 1 ? base : `(${base}:${weight})`;
}

function splitToChips(text) {
    return text.split(",").map((s) => s.trim()).filter((s) => s !== "");
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function defaultBlocks() {
    return DEFAULT_BLOCK_NAMES.map((name) => ({ name, enabled: true, chips: [] }));
}

/** Shape-checks a blocks array without filling in defaults. */
function mapBlocks(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((b) => b && typeof b === "object")
        .map((b) => ({
            name: typeof b.name === "string" ? b.name : "",
            enabled: b.enabled !== false,
            chips: Array.isArray(b.chips) ? b.chips.filter((c) => typeof c === "string") : [],
        }));
}

function normaliseBlocks(raw) {
    const blocks = mapBlocks(raw);
    return blocks.length ? blocks : defaultBlocks();
}

function readState(widget) {
    try {
        const parsed = JSON.parse(widget.value);
        if (parsed && typeof parsed === "object") return normaliseBlocks(parsed.blocks);
    } catch (e) {
        console.warn("[PromptEditor] Unreadable blocks value, starting from defaults.", e);
    }
    return defaultBlocks();
}

/** Hide the data widget: it is storage, not UI. */
function hideWidget(widget) {
    widget.hidden = true;
    widget.draw = () => {};
    widget.computeSize = () => [0, -4];
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function showSaveTemplateDialog(existingCategories) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "pe-modal-overlay";

        const box = document.createElement("div");
        box.className = "pe-modal";

        const title = document.createElement("div");
        title.className = "pe-modal-title";
        title.textContent = "Save Template";

        const catWrap = document.createElement("div");
        const catLabel = document.createElement("label");
        catLabel.textContent = "Category (Optional)";
        const catInput = document.createElement("input");
        catInput.placeholder = "e.g. Characters / Styles";
        catInput.setAttribute("list", "pe-template-categories");
        const datalist = document.createElement("datalist");
        datalist.id = "pe-template-categories";
        for (const c of existingCategories) {
            const opt = document.createElement("option");
            opt.value = c;
            datalist.appendChild(opt);
        }
        catWrap.append(catLabel, catInput, datalist);

        const nameWrap = document.createElement("div");
        const nameLabel = document.createElement("label");
        nameLabel.textContent = "Template Name";
        const nameInput = document.createElement("input");
        nameWrap.append(nameLabel, nameInput);

        const buttons = document.createElement("div");
        buttons.className = "pe-modal-buttons";
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "pe-modal-btn cancel";
        cancelBtn.textContent = "Cancel";
        const confirmBtn = document.createElement("button");
        confirmBtn.className = "pe-modal-btn confirm";
        confirmBtn.textContent = "Save";
        buttons.append(cancelBtn, confirmBtn);

        const close = (val) => {
            overlay.remove();
            resolve(val);
        };
        cancelBtn.onclick = () => close(null);
        confirmBtn.onclick = () => close({ name: nameInput.value.trim(), category: catInput.value.trim() });

        nameInput.onkeydown = (e) => {
            if (e.key === "Enter") confirmBtn.click();
            if (e.key === "Escape") cancelBtn.click();
        };
        catInput.onkeydown = (e) => {
            if (e.key === "Enter") nameInput.focus();
            if (e.key === "Escape") cancelBtn.click();
        };
        box.onclick = (e) => e.stopPropagation();
        overlay.onclick = (e) => {
            if (e.target === overlay) cancelBtn.click();
        };

        box.append(title, catWrap, nameWrap, buttons);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        catInput.focus();
    });
}

// ---------------------------------------------------------------------------
// Template API
// ---------------------------------------------------------------------------
// A template's content is a *list of blocks*. Length 1 is a single-block
// template (a character, a quality prefix); length N is a whole prompt. One
// structure covers both, so there is no "block template" vs "prompt template".

/**
 * Folders are plain objects. Note the Array check: a template's content is an
 * array, and `typeof [] === "object"` would otherwise make it look like a folder.
 */
function isFolder(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Accepts the current list format, and the old comma-string format. */
function templateToBlocks(content) {
    if (typeof content === "string") {
        return [{ name: "", enabled: true, chips: splitToChips(content) }];
    }
    return mapBlocks(content);
}

async function fetchTemplates() {
    const response = await api.fetchApi("/prompt_editor/get_templates");
    return await response.json();
}

async function saveTemplate(name, category, content) {
    const response = await api.fetchApi("/prompt_editor/save_template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_name: name, category, content }),
    });
    if (response.status !== 200) throw new Error(await response.text());
}

async function deleteTemplate(name, category) {
    const response = await api.fetchApi("/prompt_editor/delete_template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_name: name, category }),
    });
    if (response.status !== 200) throw new Error("Server error: " + response.status);
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

app.registerExtension({
    name: "Comfy.PromptEditor",
    async nodeCreated(node) {
        if (node.comfyClass !== "PromptEditor" && node.type !== "PromptEditor") return;
        setTimeout(() => createEditor(node), 100);
    },
});

function createEditor(node) {
    if (node.__promptEditor) return;
    const dataWidget = node.widgets?.find((w) => w.name === "blocks");
    if (!dataWidget) {
        console.warn("[PromptEditor] No 'blocks' widget found on node", node.id);
        return;
    }

    hideWidget(dataWidget);

    let blocks = readState(dataWidget);

    const root = document.createElement("div");
    root.className = "pe-root";

    // ----- persistence -----

    function commit() {
        dataWidget.value = JSON.stringify({ version: STATE_VERSION, blocks });
        if (dataWidget.callback) dataWidget.callback(dataWidget.value);
        app.graph?.setDirtyCanvas(true, true);
    }

    /**
     * Show a dropdown below its anchor, or above it when below would open past
     * the scroll container's bottom edge and there is more room above.
     *
     * Deliberately not portalled to document.body: that is the coupling
     * ADR-0003 removed, and it would have to re-sync on every canvas pan.
     */
    function placeDropdown(dropdown) {
        dropdown.style.top = "100%";
        dropdown.style.bottom = "auto";
        dropdown.style.display = "flex";

        const rootRect = root.getBoundingClientRect();
        const ddRect = dropdown.getBoundingClientRect();
        const roomBelow = rootRect.bottom - ddRect.top;
        const roomAbove = ddRect.bottom - dropdown.offsetHeight - rootRect.top;

        if (ddRect.bottom > rootRect.bottom && roomAbove > roomBelow) {
            dropdown.style.top = "auto";
            dropdown.style.bottom = "100%";
        }
    }

    // ----- rendering -----

    const placeholder = document.createElement("div");
    placeholder.className = "pe-placeholder";

    function renderAll() {
        root.replaceChildren();
        blocks.forEach((block, index) => root.appendChild(renderBlock(block, index)));

        const footer = document.createElement("div");
        footer.className = "pe-footer";

        const addBtn = document.createElement("div");
        addBtn.className = "pe-add-block";
        addBtn.textContent = "+ 新增區塊";
        addBtn.onclick = () => {
            blocks.push({ name: "", enabled: true, chips: [] });
            commit();
            renderAll();
        };

        const allTemplateBtn = document.createElement("div");
        allTemplateBtn.className = "pe-block-btn";
        allTemplateBtn.textContent = "📑";
        allTemplateBtn.title = "整份提詞的範本";

        const allTemplateMenu = document.createElement("div");
        allTemplateMenu.className = "pe-dropdown";
        allTemplateMenu.style.left = "auto";
        allTemplateMenu.style.right = "0";

        footer.append(addBtn, allTemplateBtn, allTemplateMenu);
        root.appendChild(footer);

        wireTemplateMenu(allTemplateBtn, allTemplateMenu, {
            collect: () => blocks.map((b) => ({ name: b.name, enabled: b.enabled, chips: [...b.chips] })),
            apply: (tplBlocks) => {
                blocks = tplBlocks.length ? tplBlocks : defaultBlocks();
            },
        });

        requestRedraw();
    }

    function renderBlock(block, index) {
        const el = document.createElement("div");
        el.className = "pe-block" + (block.enabled ? "" : " disabled");
        el.dataset.blockIndex = String(index);

        // --- header ---
        const header = document.createElement("div");
        header.className = "pe-block-header";

        const toggle = document.createElement("div");
        toggle.className = "pe-toggle";
        toggle.textContent = block.enabled ? "☑" : "☐";
        toggle.title = block.enabled ? "停用這個區塊（保留內容）" : "啟用這個區塊";
        toggle.onclick = () => {
            block.enabled = !block.enabled;
            commit();
            renderAll();
        };

        const nameInput = document.createElement("input");
        nameInput.className = "pe-block-name";
        nameInput.value = block.name;
        nameInput.placeholder = "區塊名稱";
        // Deliberately does not re-render: that would steal focus mid-typing.
        nameInput.oninput = () => {
            block.name = nameInput.value;
            commit();
        };

        const upBtn = document.createElement("div");
        upBtn.className = "pe-block-btn" + (index === 0 ? " disabled" : "");
        upBtn.textContent = "↑";
        upBtn.title = "上移";
        upBtn.onclick = () => moveBlock(index, -1);

        const downBtn = document.createElement("div");
        downBtn.className = "pe-block-btn" + (index === blocks.length - 1 ? " disabled" : "");
        downBtn.textContent = "↓";
        downBtn.title = "下移";
        downBtn.onclick = () => moveBlock(index, 1);

        const templateBtn = document.createElement("div");
        templateBtn.className = "pe-block-btn";
        templateBtn.textContent = "📑";
        templateBtn.title = "範本";

        const deleteBtn = document.createElement("div");
        deleteBtn.className = "pe-block-btn danger";
        deleteBtn.textContent = "🗑";
        deleteBtn.title = "刪除這個區塊";
        deleteBtn.onclick = () => {
            const label = block.name || `區塊 ${index + 1}`;
            if (block.chips.length && !confirm(`刪除「${label}」和它的 ${block.chips.length} 個標籤？`)) return;
            blocks.splice(index, 1);
            if (!blocks.length) blocks.push({ name: "", enabled: true, chips: [] });
            commit();
            renderAll();
        };

        header.append(toggle, nameInput, upBtn, downBtn, templateBtn, deleteBtn);

        // --- chips area ---
        const chipsArea = document.createElement("div");
        chipsArea.className = "pe-chips";

        const input = document.createElement("input");
        input.className = "pe-input";
        input.placeholder = "加標籤…";

        const autocomplete = document.createElement("div");
        autocomplete.className = "pe-dropdown";

        const templateMenu = document.createElement("div");
        templateMenu.className = "pe-dropdown";
        templateMenu.style.left = "auto";
        templateMenu.style.right = "0";

        chipsArea.append(input, autocomplete, templateMenu);
        el.append(header, chipsArea);

        wireTemplateMenu(templateBtn, templateMenu, {
            collect: () => {
                const chips = [...block.chips];
                const pending = input.value.trim();
                if (pending) chips.push(...splitToChips(pending));
                return [{ name: block.name, enabled: block.enabled, chips }];
            },
            // A multi-block template dropped on one block lands as one block.
            apply: (tplBlocks) => {
                block.chips = tplBlocks.flatMap((b) => b.chips);
            },
            extraLabel: "清空這個區塊",
            extraAction: () => {
                if (!block.chips.length) return false;
                if (!confirm(`清空「${block.name || "這個區塊"}」的 ${block.chips.length} 個標籤？`)) return false;
                block.chips = [];
                commit();
                renderAll();
                return true;
            },
        });
        wireInput(block, index, input, autocomplete, chipsArea);
        wireDropTarget(index, chipsArea, input);

        chipsArea.onclick = (e) => {
            if (e.target === chipsArea) input.focus();
        };

        renderChips(block, index, chipsArea, input);
        return el;
    }

    function renderChips(block, index, chipsArea, input) {
        for (const stale of Array.from(chipsArea.querySelectorAll(".pe-chip"))) stale.remove();

        block.chips.forEach((chipText, chipIndex) => {
            chipsArea.insertBefore(buildChip(block, index, chipText, chipIndex, chipsArea, input), input);
        });
    }

    function buildChip(block, blockIndex, chipText, chipIndex, chipsArea, input) {
        const chip = document.createElement("div");
        chip.className = "pe-chip";
        chip.draggable = true;
        chip.title = "Shift+滾輪 調整權重，雙擊編輯";

        // The chip shows the bare tag. The weight gets its own control, so the
        // stored "(1girl:1.2)" never has to be read as text by a human.
        const { base, weight } = splitWeight(chipText);
        const textSpan = document.createElement("span");
        const tag = tagsByEn.get(base);
        textSpan.textContent = base;
        if (tag && tag.zh) {
            const zh = document.createElement("span");
            zh.className = "zh";
            zh.textContent = ` (${tag.zh})`;
            textSpan.appendChild(zh);
        }
        chip.appendChild(textSpan);

        function setWeight(next) {
            const rounded = Math.round(next * 10) / 10;
            if (rounded < WEIGHT_MIN || rounded > WEIGHT_MAX) return;
            block.chips[chipIndex] = joinWeight(splitWeight(block.chips[chipIndex]).base, rounded);
            commit();
            renderChips(block, blockIndex, chipsArea, input);
        }

        const weightCtl = document.createElement("span");
        weightCtl.className = "pe-weight" + (weight === 1 ? "" : " active");

        const minusBtn = document.createElement("span");
        minusBtn.className = "pe-weight-btn";
        minusBtn.textContent = "−";
        minusBtn.title = `降低權重（下限 ${WEIGHT_MIN}）`;
        minusBtn.onclick = (e) => {
            e.stopPropagation();
            setWeight(splitWeight(block.chips[chipIndex]).weight - WEIGHT_STEP);
        };

        const weightVal = document.createElement("span");
        weightVal.className = "pe-weight-val";
        weightVal.textContent = weight.toFixed(1);
        weightVal.title = "點一下重設為 1.0";
        weightVal.onclick = (e) => {
            e.stopPropagation();
            setWeight(1);
        };

        const plusBtn = document.createElement("span");
        plusBtn.className = "pe-weight-btn";
        plusBtn.textContent = "+";
        plusBtn.title = `提高權重（上限 ${WEIGHT_MAX}）`;
        plusBtn.onclick = (e) => {
            e.stopPropagation();
            setWeight(splitWeight(block.chips[chipIndex]).weight + WEIGHT_STEP);
        };

        weightCtl.append(minusBtn, weightVal, plusBtn);
        chip.appendChild(weightCtl);

        const removeBtn = document.createElement("span");
        removeBtn.className = "pe-chip-remove";
        removeBtn.textContent = "×";
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            block.chips.splice(chipIndex, 1);
            commit();
            renderChips(block, blockIndex, chipsArea, input);
            requestRedraw();
        };
        chip.appendChild(removeBtn);

        // Verified working as-is; left untouched on purpose.
        chip.addEventListener("wheel", (e) => {
            if (!e.shiftKey) return;
            e.preventDefault();
            e.stopPropagation();
            setWeight(splitWeight(block.chips[chipIndex]).weight + (e.deltaY < 0 ? WEIGHT_STEP : -WEIGHT_STEP));
        });

        chip.addEventListener("dblclick", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const editInput = document.createElement("input");
            editInput.className = "pe-chip-edit";
            editInput.value = block.chips[chipIndex];
            editInput.style.width = Math.max(30, textSpan.offsetWidth) + "px";
            chip.replaceChild(editInput, textSpan);
            editInput.focus();
            editInput.select();

            let committed = false;
            const commitEdit = () => {
                if (committed) return;
                committed = true;
                const newVal = editInput.value.trim();
                if (newVal) block.chips[chipIndex] = newVal;
                else block.chips.splice(chipIndex, 1);
                commit();
                renderChips(block, blockIndex, chipsArea, input);
                requestRedraw();
            };
            editInput.addEventListener("blur", commitEdit);
            editInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    editInput.blur();
                }
            });
        });

        chip.addEventListener("dragstart", (e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData(
                "text/plain",
                JSON.stringify({ nodeId: node.id, blockIndex, chipIndex, text: block.chips[chipIndex] })
            );

            const ghost = chip.cloneNode(true);
            Object.assign(ghost.style, {
                position: "absolute",
                top: "-9999px",
                left: "-9999px",
                transform: "rotate(5deg) scale(1.1)",
                background: "#2a81f6",
                color: "white",
                opacity: "1",
                width: chip.offsetWidth + "px",
            });
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 10, 10);
            requestAnimationFrame(() => ghost.remove());

            chip.classList.add("dragging");
        });

        chip.addEventListener("dragend", () => chip.classList.remove("dragging"));

        return chip;
    }

    // ----- block ordering -----

    function moveBlock(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= blocks.length) return;
        const [moved] = blocks.splice(index, 1);
        blocks.splice(target, 0, moved);
        commit();
        renderAll();
    }

    // ----- drag & drop -----

    function wireDropTarget(blockIndex, chipsArea, input) {
        chipsArea.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";

            let insertBefore = null;
            for (const chipEl of chipsArea.getElementsByClassName("pe-chip")) {
                if (chipEl.classList.contains("dragging")) continue;
                const rect = chipEl.getBoundingClientRect();
                if (e.clientY > rect.bottom) continue;
                if (e.clientY < rect.top) {
                    insertBefore = chipEl;
                    break;
                }
                if (e.clientX < rect.left + rect.width / 2) {
                    insertBefore = chipEl;
                    break;
                }
            }

            const anchor = insertBefore || input;
            if (placeholder.nextElementSibling !== anchor || placeholder.parentNode !== chipsArea) {
                chipsArea.insertBefore(placeholder, anchor);
            }
        });

        chipsArea.addEventListener("dragleave", (e) => {
            if (!chipsArea.contains(e.relatedTarget) && placeholder.parentNode === chipsArea) {
                placeholder.remove();
            }
        });

        chipsArea.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Index is counted before anything is mutated, and skips the chip
            // being dragged — so it stays correct for same-block reordering.
            let dropIndex = -1;
            if (placeholder.parentNode === chipsArea) {
                let count = 0;
                for (const child of chipsArea.children) {
                    if (child === placeholder) {
                        dropIndex = count;
                        break;
                    }
                    if (child.classList.contains("pe-chip") && !child.classList.contains("dragging")) count++;
                }
                placeholder.remove();
            }

            let data;
            try {
                data = JSON.parse(e.dataTransfer.getData("text/plain"));
            } catch {
                return;
            }
            if (!data || typeof data.text !== "string") return;

            removeChipFrom(data);

            const targetBlock = blocks[blockIndex];
            if (!targetBlock) return;
            if (dropIndex < 0 || dropIndex > targetBlock.chips.length) dropIndex = targetBlock.chips.length;
            targetBlock.chips.splice(dropIndex, 0, data.text);

            commit();
            renderAll();
        });
    }

    /** Remove the dragged chip from wherever it came from, this node or another. */
    function removeChipFrom(data) {
        if (data.nodeId === node.id) {
            removeLocal(blocks, data);
            return;
        }
        const sourceNode = app.graph?.getNodeById(data.nodeId);
        const sourceEditor = sourceNode?.__promptEditor;
        if (sourceEditor) sourceEditor.removeChip(data);
    }

    function removeLocal(targetBlocks, data) {
        const block = targetBlocks[data.blockIndex];
        if (!block) return;
        if (block.chips[data.chipIndex] === data.text) block.chips.splice(data.chipIndex, 1);
        else {
            const idx = block.chips.indexOf(data.text);
            if (idx !== -1) block.chips.splice(idx, 1);
        }
    }

    // ----- text input & autocomplete -----

    function wireInput(block, blockIndex, input, dropdown, chipsArea) {
        let visibleTags = [];
        let selectedIndex = -1;

        const closeAutocomplete = () => {
            dropdown.style.display = "none";
            visibleTags = [];
            selectedIndex = -1;
        };

        const updateSelection = () => {
            Array.from(dropdown.children).forEach((item, i) => {
                item.classList.toggle("selected", i === selectedIndex);
                if (i === selectedIndex) item.scrollIntoView({ block: "nearest" });
            });
        };

        const addChips = (texts) => {
            if (!texts.length) return;
            block.chips.push(...texts);
            input.value = "";
            commit();
            renderChips(block, blockIndex, chipsArea, input);
            requestRedraw();
        };

        const renderAutocomplete = (filterText) => {
            if (!filterText || !availableTags.length) return closeAutocomplete();

            const lower = filterText.toLowerCase();
            visibleTags = availableTags
                .filter((tag) => tag.en.toLowerCase().includes(lower) || (tag.zh && tag.zh.includes(filterText)))
                .slice(0, 20);

            if (!visibleTags.length) return closeAutocomplete();

            dropdown.replaceChildren();
            visibleTags.forEach((tag, i) => {
                const item = document.createElement("div");
                item.className = "pe-dropdown-item";
                const label = document.createElement("span");
                label.textContent = tag.zh ? `${tag.en} (${tag.zh})` : tag.en;
                item.appendChild(label);
                if (tag.cat) {
                    const cat = document.createElement("span");
                    cat.className = "cat";
                    cat.textContent = tag.cat;
                    item.appendChild(cat);
                }
                if (i === selectedIndex) item.classList.add("selected");
                item.onmousedown = (e) => {
                    // mousedown, not click: blur would fire first and eat it.
                    e.preventDefault();
                    e.stopPropagation();
                    addChips([tag.en]);
                    closeAutocomplete();
                    input.focus();
                };
                dropdown.appendChild(item);
            });
            placeDropdown(dropdown);
        };

        input.addEventListener("keydown", (e) => {
            if (dropdown.style.display === "flex" && visibleTags.length) {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    selectedIndex = (selectedIndex + 1) % visibleTags.length;
                    return updateSelection();
                }
                if (e.key === "ArrowUp") {
                    e.preventDefault();
                    selectedIndex = selectedIndex <= 0 ? visibleTags.length - 1 : selectedIndex - 1;
                    return updateSelection();
                }
                if ((e.key === "Enter" || e.key === "Tab") && selectedIndex >= 0) {
                    e.preventDefault();
                    addChips([visibleTags[selectedIndex].en]);
                    closeAutocomplete();
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    return closeAutocomplete();
                }
            }

            if (e.key === "Enter") {
                e.preventDefault();
                addChips(splitToChips(input.value));
                closeAutocomplete();
            } else if (e.key === "Backspace" && input.value === "" && block.chips.length) {
                block.chips.pop();
                commit();
                renderChips(block, blockIndex, chipsArea, input);
                requestRedraw();
            }
        });

        input.addEventListener("input", () => {
            if (input.value.includes(",")) {
                const parts = input.value.split(",");
                const trailing = parts.pop();
                addChips(parts.map((s) => s.trim()).filter(Boolean));
                input.value = trailing;
            }
            selectedIndex = 0;
            renderAutocomplete(input.value.trim());
        });

        input.addEventListener("blur", () => {
            setTimeout(() => {
                closeAutocomplete();
                addChips(splitToChips(input.value));
            }, 150);
        });
    }

    // ----- templates -----

    /**
     * `scope` decides what a template means here:
     *   collect() -> the blocks to save
     *   apply(blocks) -> what to do with a loaded template
     *   extraLabel/extraAction -> optional first action (e.g. clearing)
     */
    function wireTemplateMenu(trigger, menu, scope) {
        const close = () => {
            menu.style.display = "none";
        };

        trigger.onclick = async (e) => {
            e.stopPropagation();
            if (menu.style.display === "flex") {
                close();
                openDropdown = null;
                return;
            }
            closeOpenDropdown();
            openDropdown = { element: menu, trigger, close };
            await refreshMenu();
            // Only now is the menu's real height known, so this is where the
            // flip-up decision can actually be made.
            placeDropdown(menu);
        };

        const addItem = (parent, label, className, onClick) => {
            const item = document.createElement("div");
            item.className = "pe-dropdown-item" + (className ? " " + className : "");
            const span = document.createElement("span");
            span.textContent = label;
            item.appendChild(span);
            if (onClick) item.onclick = onClick;
            parent.appendChild(item);
            return item;
        };

        async function refreshMenu() {
            menu.replaceChildren();
            menu.style.display = "flex";

            addItem(menu, "+ 存成範本…", "action", async (e) => {
                e.stopPropagation();
                let categories = [];
                try {
                    const templates = await fetchTemplates();
                    categories = Object.keys(templates).filter((k) => isFolder(templates[k]));
                } catch {
                    /* offering no suggestions is fine */
                }
                const result = await showSaveTemplateDialog(categories);
                if (!result || !result.name) return;

                try {
                    await saveTemplate(result.name, result.category, scope.collect());
                    await refreshMenu();
                } catch (err) {
                    alert("Failed to save template: " + err.message);
                }
            });

            if (scope.extraLabel) {
                addItem(menu, scope.extraLabel, "", (e) => {
                    e.stopPropagation();
                    if (scope.extraAction()) {
                        close();
                        openDropdown = null;
                    }
                });
            }

            let templates;
            try {
                templates = await fetchTemplates();
            } catch (err) {
                console.error("Error fetching templates", err);
                addItem(menu, "Error loading templates", "empty");
                return;
            }

            const applyTemplate = (content) => {
                scope.apply(templateToBlocks(content));
                commit();
                renderAll();
                close();
                openDropdown = null;
            };

            const renderTemplate = (name, content, parent, category) => {
                const item = addItem(parent, name, "", (ev) => {
                    ev.stopPropagation();
                    applyTemplate(content);
                });
                if (category) item.style.paddingLeft = "20px";

                const del = document.createElement("span");
                del.className = "pe-template-delete";
                del.textContent = "×";
                del.title = "Delete Template";
                del.onclick = async (ev) => {
                    ev.stopPropagation();
                    if (!confirm(`Delete template "${name}"?`)) return;
                    try {
                        await deleteTemplate(name, category);
                        await refreshMenu();
                    } catch (err) {
                        alert("Failed to delete template: " + err.message);
                    }
                };
                item.appendChild(del);
            };

            const keys = Object.keys(templates).sort((a, b) => {
                const aFolder = isFolder(templates[a]);
                const bFolder = isFolder(templates[b]);
                if (aFolder !== bFolder) return aFolder ? -1 : 1;
                return a.localeCompare(b);
            });

            if (!keys.length) {
                addItem(menu, "No saved templates", "empty");
                return;
            }

            for (const key of keys) {
                if (isFolder(templates[key])) {
                    const list = document.createElement("div");
                    list.style.display = "none";
                    const header = addItem(menu, `📂 ${key}`, "", (ev) => {
                        ev.stopPropagation();
                        list.style.display = list.style.display === "none" ? "block" : "none";
                    });
                    header.style.fontWeight = "bold";
                    menu.appendChild(list);
                    for (const itemName of Object.keys(templates[key])) {
                        renderTemplate(itemName, templates[key][itemName], list, key);
                    }
                } else {
                    renderTemplate(key, templates[key], menu, null);
                }
            }
        }
    }

    // ----- sizing -----

    let redrawQueued = false;
    function requestRedraw() {
        if (redrawQueued) return;
        redrawQueued = true;
        requestAnimationFrame(() => {
            redrawQueued = false;
            node.setDirtyCanvas(true, true);
        });
    }

    /**
     * Grow the node once so its content is visible from the start. Deliberately
     * one-shot: continuous fitting is what made the node impossible to shrink.
     */
    function fitToContent() {
        requestAnimationFrame(() => {
            const shortfall = root.scrollHeight - root.clientHeight;
            if (shortfall > 0) {
                node.setSize([node.size[0], node.size[1] + shortfall]);
                node.setDirtyCanvas(true, true);
            }
        });
    }

    // ----- mount -----

    renderAll();

    node.addDOMWidget("prompt_editor_ui", "div", root, {
        serialize: false,
        // MUST be a constant. Deriving this from content height makes the floor
        // rise with the content, which silently takes away the user's ability to
        // shrink the node. 60 matches ComfyUI's own built-in DOM widgets.
        getMinHeight: () => 60,
    });

    fitToContent();

    node.__promptEditor = {
        /** Called when a chip is dragged out of this node into another one. */
        removeChip(data) {
            removeLocal(blocks, data);
            commit();
            renderAll();
        },
    };

    // Re-read state when a workflow is loaded on top of this node.
    const originalOnConfigure = node.onConfigure;
    node.onConfigure = function () {
        if (originalOnConfigure) originalOnConfigure.apply(this, arguments);
        blocks = readState(dataWidget);
        renderAll();
        fitToContent();
    };
}
