import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Global tracking for open menus to simulate "single open" behavior
let activeTemplateMenu = null;
const closeActiveMenu = () => {
    if (activeTemplateMenu && activeTemplateMenu.close) {
        activeTemplateMenu.close();
        activeTemplateMenu = null;
    }
};

// Close when clicking document
document.addEventListener("click", (e) => {
    if (activeTemplateMenu && !activeTemplateMenu.element.contains(e.target) && e.target !== activeTemplateMenu.trigger) {
        closeActiveMenu();
    }
});

// Utility to inject styles
const styleElement = document.createElement("style");
styleElement.textContent = `
    .comfy-chip-container {
        min-height: 50px;
        min-width: 200px;
        background-color: var(--comfy-input-bg);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 5px;
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        align-items: center;
        margin-bottom: 5px;
        cursor: text;
        z-index: 1; /* Lower z-index to be below dialogs but above canvas */
        position: relative; /* For clear button positioning */
        padding-right: 25px; /* Make space for clear button */
    }
    
    .comfy-chip {
        margin: 0 4px;
        background-color: var(--comfy-menu-bg);
        color: var(--fg-color);
        padding: 2px 8px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: grab;
        user-select: none;
        border: 1px solid var(--border-color);
        font-size: 12px;
        transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.2s;
    }
    
    .comfy-chip:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: 10;
        background-color: var(--comfy-input-bg);
    }

    .comfy-chip:active {
        cursor: grabbing;
        transform: scale(0.98);
        box-shadow: none;
    }

    .comfy-chip.dragging {
        opacity: 0.5;
    }

    .comfy-chip-remove {
        cursor: pointer;
        font-weight: bold;
        color: #ff6b6b;
        margin-left: 2px;
    }

    .comfy-chip-remove:hover {
        color: #ff0000;
    }

    .comfy-chip-input {
        flex-grow: 1;
        min-width: 60px;
        background: transparent;
        border: none;
        color: var(--fg-color);
        outline: none;
        font-size: 12px;
        padding: 2px;
        margin: 5px;
    }

    .comfy-chip-clear-all {
        position: absolute;
        top: 2px;
        right: 2px;
        cursor: pointer;
        color: #888;
        font-size: 14px;
        width: 16px;
        height: 16px;
        line-height: 14px;
        text-align: center;
        border-radius: 50%;
        background: rgba(0,0,0,0.1);
        display: none; /* Hidden by default */
        z-index: 10000;
    }

    .comfy-chip-clear-all:hover {
        color: #ff4444;
        background: rgba(0,0,0,0.2);
    }

    .comfy-chip-placeholder {
        width: 60px; /* Default width, will be dynamic if possible or fixed min-width */
        height: 24px;
        background-color: rgba(255, 255, 255, 0.05);
        border: 1px dashed var(--primary-color, #2a81f6);
        border-radius: 12px;
        margin: 0 4px;
        pointer-events: none;
        flex-shrink: 0;
        animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes popIn {
        from { transform: scale(0); width: 0; margin: 0; opacity: 0; }
        to { transform: scale(1); width: 60px; margin: 0 4px; opacity: 1; }
    }

    /* Autocomplete Styles */
    .comfy-autocomplete-container {
        position: absolute;
        bottom: 100%;
        left: 0;
        min-width: 200px;
        max-height: 200px;
        overflow-y: auto;
        background-color: var(--comfy-menu-bg);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        z-index: 99; /* Higher than container but reasonable */
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        display: none;
        flex-direction: column;
    }

    .comfy-autocomplete-item {
        padding: 5px 10px;
        cursor: pointer;
        color: var(--fg-color);
        font-size: 12px;
        border-bottom: 1px solid var(--border-color);
    }

    .comfy-autocomplete-item:last-child {
        border-bottom: none;
    }

    .comfy-autocomplete-item:hover, .comfy-autocomplete-item.selected {
        background-color: var(--primary-color, #2a81f6);
        color: white;
    }
    
    /* Custom Prompt Modal */
    .comfy-custom-prompt-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        z-index: 20000;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .comfy-custom-prompt-box {
        background: var(--comfy-menu-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 20px;
        min-width: 300px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    .comfy-custom-prompt-title {
        font-weight: bold;
        color: var(--fg-color);
        font-size: 14px;
    }
    .comfy-custom-prompt-input {
        background: var(--comfy-input-bg);
        border: 1px solid var(--border-color);
        color: var(--fg-color);
        border-radius: 4px;
        padding: 8px;
        outline: none;
    }
    .comfy-custom-prompt-input:focus {
        border-color: var(--primary-color, #2a81f6);
    }
    .comfy-custom-prompt-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }
    .comfy-custom-prompt-btn {
        padding: 5px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        border: none;
    }
    .comfy-custom-prompt-btn.cancel {
        background: var(--comfy-input-bg);
        color: var(--fg-color);
    }
    .comfy-custom-prompt-btn.confirm {
        background: var(--primary-color, #2a81f6);
        color: white;
    }
    .comfy-custom-prompt-btn:hover {
        opacity: 0.9;
    }
    
    .comfy-autocomplete-item .sub-text {
        font-size: 0.85em;
        opacity: 0.7;
        margin-left: 5px;
    }

    /* Template Menu Styles */
    .comfy-chip-template-btn {
        position: absolute;
        top: 2px;
        right: 22px; /* Next to clear btn */
        cursor: pointer;
        color: #888;
        font-size: 14px;
        width: 16px;
        height: 16px;
        line-height: 14px;
        text-align: center;
        border-radius: 50%;
        background: rgba(0,0,0,0.1);
        z-index: 1000;
        display: block !important; 
    }
    .comfy-chip-template-btn:hover {
        color: var(--primary-color, #2a81f6);
        background: rgba(0,0,0,0.2);
    }
    
    .comfy-template-menu {
        position: absolute;
        top: 20px;
        right: 0;
        min-width: 150px;
        background: var(--comfy-menu-bg);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        z-index: 10001;
        display: none;
        flex-direction: column;
        overflow: hidden;
    }
    
    .comfy-template-menu-item {
        padding: 5px 10px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--border-color);
        font-size: 12px;
        color: var(--fg-color);
    }
    .comfy-template-menu-item:hover {
        background: var(--comfy-input-bg);
    }
    .comfy-template-menu-item.action {
        font-weight: bold;
        color: var(--primary-color, #2a81f6);
    }
    .comfy-template-menu-item.empty {
        font-style: italic;
        opacity: 0.6;
        cursor: default;
    }
    .comfy-template-delete {
        color: #ff6b6b;
        font-weight: bold;
        padding: 0 5px;
        border-radius: 4px;
    }
    .comfy-template-delete:hover {
        background: rgba(255,0,0,0.1);
        color: #ff0000;
    }
`;
document.head.appendChild(styleElement);

console.log("Loading DynamicStringTools extension...");

// Load tags
let availableTags = [];
const tagsPath = new URL("./tags.json", import.meta.url).href; // Construct absolute URL relative to this script
fetch(tagsPath)
    .then(response => response.json())
    .then(data => {
        availableTags = data;
        console.log(`Loaded ${availableTags.length} tags for autocomplete.`);
    })
    .catch(err => {
        console.error("Failed to load tags.json:", err);
    });

// Global Watchdog for Visibility
// This ensures that when nodes are collapsed, the input boxes are definitely hidden.
// Event-based handling can be flaky if drawing logic stops running (which it does when collapsed).
const activeChipWidgets = new Set();

setInterval(() => {
    activeChipWidgets.forEach(item => {
        const { node, container } = item;

        // Safety check if node removed but cleanup missed
        if (!node.graph) {
            container.remove();
            activeChipWidgets.delete(item);
            return;
        }

        // 1. Collapse Check
        if (node.flags && node.flags.collapsed) {
            if (container.style.display !== "none") {
                container.style.display = "none";
            }
        }
        // Note: We don't force "flex" here because widget.draw handles showing it when appropriate
        // (including positioning). If we forced flex here, it might show up at wrong (0,0) position.
    });
}, 50);

app.registerExtension({
    name: "Comfy.DynamicStringTools",
    async nodeCreated(node) {
        // console.log("Node created:", node.comfyClass, node.type, node.title);
        if (node.comfyClass === "DynamicStringCombiner" || node.type === "DynamicStringCombiner") {
            console.log("Found DynamicStringCombiner node!", node);
            // Wait for widgets to be initialized
            setTimeout(() => {
                enhanceNode(node);
            }, 100);
        }
    }
});

function enhanceNode(node) {
    if (!node.widgets) return;

    // Enhance string_1 to string_10 widgets
    for (let i = 1; i <= 10; i++) {
        const widgetName = `string_${i}`;
        const widget = node.widgets.find(w => w.name === widgetName);
        if (widget) {
            console.log("Enhancing widget:", widgetName);
            transformToChips(widget, node);
        }
    }
}

function transformToChips(widget, node) {
    // Hide the original widget input but keep it for data storage
    // ComfyUI widgets usually draw themselves on canvas, but standard DOM widgets exist too.
    // For "STRING" type with "multiline": True, ComfyUI often uses a DOM textarea overlay when editing,
    // or just draws text. 
    // We want to replace the standard interaction.

    // NOTE: ComfyUI's custom widget handling is tricky. We can't easily "replace" the canvas drawing 
    // completely without reimplementing the draw method, but we can augment it by creating a DOM element 
    // that overlays or sits in the properties panel if that's where it is.
    // However, usually nodes are on canvas.

    // BETTER APPROACH for Canvas nodes:
    // Create a DOM element that floats over the node or use the standard `widget.element` if it exists.
    // But basic STRING widgets don't always expose a persistent DOM element on the canvas until clicked.

    // Actually, allowing full DOM interaction on canvas usually involves creating a custom widget type.
    // But here we are patching an existing widget.

    // Let's try to override the widget's behavior to spawn our custom DOM overlay instead of the default one.

    // 1. Create a container for our chips input
    const container = document.createElement("div");
    container.className = "comfy-chip-container";

    const input = document.createElement("input");
    input.className = "comfy-chip-input";
    input.placeholder = "Add tags... (Type for suggestion)";

    container.appendChild(input);

    // This data structure will hold our chips state locally strictly for this widget instance
    let chips = [];

    // Clear All Button
    const clearBtn = document.createElement("div");
    clearBtn.className = "comfy-chip-clear-all";
    clearBtn.innerHTML = "×";
    clearBtn.title = "Clear all";
    clearBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm("Clear all chips?")) {
            chips = [];
            updateWidgetValue();
            renderChips();
        }
    };
    container.appendChild(clearBtn);

    // Template Button & Menu
    const templateBtn = document.createElement("div");
    templateBtn.className = "comfy-chip-template-btn";
    templateBtn.innerHTML = "📑"; // Bookmark tabs icon
    templateBtn.title = "Manage Templates";

    const templateMenu = document.createElement("div");
    templateMenu.className = "comfy-template-menu";

    container.appendChild(templateBtn);
    container.appendChild(templateMenu);

    const closeMenu = () => {
        templateMenu.style.display = "none";
        container.style.zIndex = ""; // Reset to CSS default
    };

    templateBtn.onclick = (e) => {
        e.stopPropagation();

        // If this menu is already open, close it
        if (templateMenu.style.display === "flex") {
            closeMenu();
            activeTemplateMenu = null;
        } else {
            // Close any other open menu
            closeActiveMenu();

            // Open this menu
            container.style.zIndex = "1005"; // Elevate above other widgets
            refreshTemplateList();

            // Register as active
            activeTemplateMenu = {
                element: templateMenu,
                trigger: templateBtn,
                close: closeMenu
            };
        }
    };

    // Custom Prompt Helper
    function showCustomPrompt(message, defaultValue = "") {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "comfy-custom-prompt-overlay";

            const box = document.createElement("div");
            box.className = "comfy-custom-prompt-box";

            const title = document.createElement("div");
            title.className = "comfy-custom-prompt-title";
            title.textContent = message;

            const inputEl = document.createElement("input");
            inputEl.className = "comfy-custom-prompt-input";
            inputEl.value = defaultValue;

            const btnContainer = document.createElement("div");
            btnContainer.className = "comfy-custom-prompt-buttons";

            const cancelBtn = document.createElement("button");
            cancelBtn.className = "comfy-custom-prompt-btn cancel";
            cancelBtn.textContent = "Cancel";

            const confirmBtn = document.createElement("button");
            confirmBtn.className = "comfy-custom-prompt-btn confirm";
            confirmBtn.textContent = "Save";

            const close = (val) => {
                document.body.removeChild(overlay);
                resolve(val);
            };

            cancelBtn.onclick = () => close(null);
            confirmBtn.onclick = () => close(inputEl.value.trim());

            inputEl.onkeydown = (e) => {
                if (e.key === "Enter") confirmBtn.click();
                if (e.key === "Escape") cancelBtn.click();
            };

            // Prevent close on box click
            box.onclick = (e) => e.stopPropagation();
            // Close on overlay click
            overlay.onclick = (e) => {
                if (e.target === overlay) cancelBtn.click();
            }

            btnContainer.appendChild(cancelBtn);
            btnContainer.appendChild(confirmBtn);

            box.appendChild(title);
            box.appendChild(inputEl);
            box.appendChild(btnContainer);
            overlay.appendChild(box);

            document.body.appendChild(overlay);
            inputEl.focus();
        });
    }

    // Document listener removed from here (moved to global scope to handle all instances)

    async function refreshTemplateList() {
        templateMenu.innerHTML = "";
        templateMenu.style.display = "flex";

        // Save Option
        const saveItem = document.createElement("div");
        saveItem.className = "comfy-template-menu-item action";
        saveItem.innerHTML = "<span>+ Save as Template...</span>";
        saveItem.onclick = async (e) => {
            e.stopPropagation();
            // Use custom prompt instead of native prompt()
            const name = await showCustomPrompt("Enter template name:");
            if (name) {
                await saveTemplate(name);
                refreshTemplateList();
            }
        };
        templateMenu.appendChild(saveItem);

        // Load Templates
        try {
            // New Global API: no query params needed
            const response = await api.fetchApi("/string_tools/get_templates");
            const templates = await response.json();

            const keys = Object.keys(templates);
            if (keys.length === 0) {
                const emptyItem = document.createElement("div");
                emptyItem.className = "comfy-template-menu-item empty";
                emptyItem.innerText = "No saved templates";
                templateMenu.appendChild(emptyItem);
            } else {
                keys.forEach(name => {
                    const item = document.createElement("div");
                    item.className = "comfy-template-menu-item";
                    item.innerHTML = `<span>${name}</span>`;

                    const deleteBtn = document.createElement("span");
                    deleteBtn.className = "comfy-template-delete";
                    deleteBtn.innerText = "×";
                    deleteBtn.title = "Delete Template";
                    deleteBtn.onclick = async (ev) => {
                        ev.stopPropagation();
                        if (confirm(`Delete template "${name}"?`)) {
                            await deleteTemplate(name);
                            refreshTemplateList();
                        }
                    };

                    item.appendChild(deleteBtn);

                    item.onclick = (ev) => {
                        if (ev.target !== deleteBtn) {
                            loadTemplateContent(templates[name]);
                            // Close menu after loading
                            closeMenu();
                            activeTemplateMenu = null;
                        }
                    };

                    templateMenu.appendChild(item);
                });
            }
        } catch (err) {
            console.error("Error fetching templates", err);
            const errorItem = document.createElement("div");
            errorItem.className = "comfy-template-menu-item empty";
            errorItem.innerText = "Error loading templates";
            templateMenu.appendChild(errorItem);
        }
    }

    async function saveTemplate(name) {
        // Combine existing chips with any pending text in the input
        let finalContent = chips.join(", ");
        const pendingInput = input.value.trim();
        if (pendingInput) {
            if (finalContent) finalContent += ", " + pendingInput;
            else finalContent = pendingInput;
        }

        console.log(`[DynamicChips] Saving template '${name}':`, finalContent);

        try {
            const response = await api.fetchApi("/string_tools/save_template", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    // Global templates: no IDs needed
                    template_name: name,
                    content: finalContent
                })
            });
            if (response.status !== 200) {
                throw new Error("Server error: " + response.status);
            }
        } catch (err) {
            alert("Failed to save template: " + err);
            console.error(err);
            throw err;
        }
    }

    async function deleteTemplate(name) {
        try {
            const response = await api.fetchApi("/string_tools/delete_template", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    template_name: name
                })
            });
            if (response.status !== 200) {
                throw new Error("Server error: " + response.status);
            }
        } catch (err) {
            alert("Failed to delete template: " + err);
        }
    }

    function loadTemplateContent(content) {
        if (content) {
            chips = content.split(",").map(s => s.trim()).filter(s => s !== "");
        } else {
            chips = [];
        }
        updateWidgetValue();
        renderChips();
    }

    // Autocomplete Container
    const autocompleteDropdown = document.createElement("div");
    autocompleteDropdown.className = "comfy-autocomplete-container";
    container.appendChild(autocompleteDropdown);

    let selectedIndex = -1;
    let visibleTags = [];

    function closeAutocomplete() {
        autocompleteDropdown.style.display = "none";
        selectedIndex = -1;
        visibleTags = [];
    }

    function selectAutocompleteItem(index) {
        if (index >= 0 && index < visibleTags.length) {
            const tag = visibleTags[index];
            // Create chip with English name
            const newChipText = tag.en;
            chips.push(newChipText);
            input.value = "";
            updateWidgetValue();
            renderChips();
            closeAutocomplete();
            input.focus();
        }
    }

    function renderAutocomplete(filterText) {
        if (!filterText || availableTags.length === 0) {
            closeAutocomplete();
            return;
        }

        const lowerFilter = filterText.toLowerCase();
        // Filter logic: match en or zh
        visibleTags = availableTags.filter(tag => {
            const enMatch = tag.en.toLowerCase().includes(lowerFilter);
            const zhMatch = tag.zh && tag.zh.includes(filterText); // case sensitive for Chinese usually fine, but includes is enough
            return enMatch || zhMatch;
        }).slice(0, 20); // Limit results

        if (visibleTags.length === 0) {
            closeAutocomplete();
            return;
        }

        autocompleteDropdown.innerHTML = "";
        visibleTags.forEach((tag, index) => {
            const item = document.createElement("div");
            item.className = "comfy-autocomplete-item";
            // Display: en (zh)
            const zhText = tag.zh ? ` (${tag.zh})` : "";
            const catText = tag.cat ? ` <span style='opacity:0.5; font-size:0.8em'>[${tag.cat}]</span>` : "";

            item.innerHTML = `<span>${tag.en}${zhText}</span>${catText}`; // Use innerHTML for styling sub-text if needed

            item.onclick = (e) => {
                e.stopPropagation();
                selectAutocompleteItem(index);
            };

            if (index === selectedIndex) {
                item.classList.add("selected");
            }

            autocompleteDropdown.appendChild(item);
        });

        autocompleteDropdown.style.display = "flex";

        // Position it? It is absolute inside container (relative).
        // container is: position relative.
        // We set .comfy-autocomplete-container { bottom: 100%; left: 0; } in CSS.
        // That puts it ABOVE the input/chips.
        // Let's adjust based on input position? 
        // The container wraps everything. So it shows up attached to the main box.
        // That's fine.
    }

    function updateSelection() {
        const items = autocompleteDropdown.children;
        for (let i = 0; i < items.length; i++) {
            if (i === selectedIndex) {
                items[i].classList.add("selected");
                // Ensure visible
                // block: 'nearest' ensures it scrolls just enough to be visible at top or bottom
                items[i].scrollIntoView({ block: "nearest" });
            } else {
                items[i].classList.remove("selected");
            }
        }
    }

    // Helper to sync value BACK to the widget

    function updateWidgetValue() {
        const newValue = chips.join(", ");
        widget.value = newValue;
        if (widget.callback) widget.callback(newValue);
        app.graph.setDirtyCanvas(true, true);
    }

    // Helper to render chips in our container
    function renderChips() {
        // Manage Clear Button Visibility
        if (chips.length > 0) {
            clearBtn.style.display = "block";
        } else {
            clearBtn.style.display = "none";
        }

        while (container.firstChild && container.firstChild !== input && container.firstChild !== clearBtn) {
            container.removeChild(container.firstChild);
        }

        chips.forEach((chipText, index) => {
            const chip = document.createElement("div");
            chip.className = "comfy-chip";
            chip.draggable = true;
            chip.dataset.index = index;
            chip.dataset.widgetName = widget.name; // identify source widget

            const textSpan = document.createElement("span");

            // Format text to show Chinese if available
            let displayText = chipText;
            let baseTag = chipText;
            let weightSuffix = "";
            let prefix = "";

            // Handle weight format (tag:1.1)
            const weightMatch = chipText.match(/^(\()(.+)(:[0-9]*\.?[0-9]+)(\))$/);
            if (weightMatch) {
                prefix = weightMatch[1];
                baseTag = weightMatch[2];
                weightSuffix = weightMatch[3] + weightMatch[4];
            }

            // Lookup translation
            if (availableTags && availableTags.length > 0) {
                const tagData = availableTags.find(t => t.en === baseTag);
                if (tagData && tagData.zh) {
                    // Format: English (Chinese)
                    // If weighted: (English (Chinese):1.1)
                    displayText = `${prefix}${baseTag} <span style="opacity:0.6; font-size:0.9em">(${tagData.zh})</span>${weightSuffix}`;
                }
            }

            textSpan.innerHTML = displayText; // Use innerHTML for styling
            chip.appendChild(textSpan);

            const removeBtn = document.createElement("span");
            removeBtn.className = "comfy-chip-remove";
            removeBtn.innerHTML = "×";
            removeBtn.onclick = (e) => {
                e.stopPropagation(); // prevent triggering container click
                chips.splice(index, 1);
                updateWidgetValue();
                renderChips();
            };
            chip.appendChild(removeBtn);

            // Chip Weight Adjustment (Wheel)
            chip.addEventListener("wheel", (e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.1 : -0.1;

                let content = chipText;
                let weight = 1.0;

                // Parse existing weight (text:1.1)
                const match = content.match(/^\((.+):([0-9]*\.?[0-9]+)\)$/);
                if (match) {
                    content = match[1];
                    weight = parseFloat(match[2]);
                }

                weight += delta;
                // Round to 1 decimal place
                weight = Math.round(weight * 10) / 10;

                // Construct new text
                if (weight === 1.0) {
                    chips[index] = content;
                } else {
                    chips[index] = `(${content}:${weight})`;
                }

                updateWidgetValue();
                renderChips();
            });

            // Double click to edit
            chip.addEventListener("dblclick", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const editInput = document.createElement("input");
                editInput.value = chips[index]; // Use current value
                Object.assign(editInput.style, {
                    width: Math.max(20, textSpan.offsetWidth) + "px", // Match width roughly
                    minWidth: "30px",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "inherit",
                    font: "inherit",
                    padding: "0"
                });

                try {
                    chip.replaceChild(editInput, textSpan);
                    editInput.focus();
                    editInput.select();

                    let committed = false;
                    const commit = () => {
                        if (committed) return;
                        committed = true;

                        const newVal = editInput.value.trim();
                        if (newVal) {
                            chips[index] = newVal;
                        } else {
                            chips.splice(index, 1);
                        }
                        updateWidgetValue();
                        renderChips();
                    };

                    editInput.addEventListener("blur", commit);
                    editInput.addEventListener("keydown", (ev) => {
                        if (ev.key === "Enter") {
                            ev.preventDefault();
                            editInput.blur();
                        }
                    });
                } catch (err) {
                    console.error("Error edit chip", err);
                }
            });

            // Drag Events
            chip.addEventListener("dragstart", (e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", JSON.stringify({
                    text: chipText,
                    sourceWidgetName: widget.name,
                    sourceNodeId: node.id,
                    index: index
                }));
                // Custom Drag Ghost
                // We create a clone off-screen or use the element itself styles
                // Standard setDragImage requires a visible element.
                // Let's create a temporary clone to style exactly how we want.

                // Note: browser default ghost is usually opacity 0.5 of element.
                // We enabled class "dragging" which sets opacity 0.5 on original.
                // If we want a "pop" effect, we can try to rely on browser or make a custom one.
                // Custom ghost element:
                const ghost = chip.cloneNode(true);
                ghost.style.position = "absolute";
                ghost.style.top = "-9999px";
                ghost.style.left = "-9999px";
                ghost.style.transform = "rotate(5deg) scale(1.1)";
                ghost.style.background = "#2a81f6"; // Primary color bg
                ghost.style.color = "white";
                ghost.style.boxShadow = "0 10px 20px rgba(0,0,0,0.3)";
                ghost.style.opacity = "1";
                ghost.style.width = chip.offsetWidth + "px";
                document.body.appendChild(ghost);

                // We need to wait for render?
                // setDragImage needs it to be visible.

                e.dataTransfer.setDragImage(ghost, 10, 10);

                requestAnimationFrame(() => {
                    document.body.removeChild(ghost);
                });

                chip.classList.add("dragging");

                // Add a global class or data attribute to blocking drag/drop on canvas if needed
                // ComfyUI canvas handles drag/drop too, we need to stop propagation.
                e.stopPropagation();
            });

            chip.addEventListener("dragend", (e) => {
                chip.classList.remove("dragging");
            });

            container.insertBefore(chip, input);
        });

        // Ensure clearBtn is always last or absolutely positioned, actually it's absolute so order in DOM doesn't matter much for display,
        // but for safety let's keep it appended? NO, absolute takes it out of flow. 
        // But if we clear content using loop above, we must ensure we don't remove clearBtn if it was before input?
        // My loop: while (container.firstChild && container.firstChild !== input && container.firstChild !== clearBtn)
        // This assumes clearBtn is AFTER chips? 
        // We initially appended clearBtn AFTER input? No, we appended input first.
        // Let's re-append clearBtn to be sure it stays or check my insertion logic.
        // renderChips uses insertBefore(chip, input). So chips are before input. 
        // clearBtn was appended to container. So it should be last.
    }

    // Initialize state from widget value
    function syncFromWidget() {
        if (typeof widget.value === "string" && widget.value.trim() !== "") {
            chips = widget.value.split(",").map(s => s.trim()).filter(s => s !== "");
        } else {
            chips = [];
        }
        renderChips();
    }

    // Initial sync
    syncFromWidget();

    // Helper to scroll the selected autocomplete item into view and update classes
    function updateSelection() {
        const items = autocompleteDropdown.children;
        for (let i = 0; i < items.length; i++) {
            if (i === selectedIndex) {
                items[i].classList.add("selected");
                items[i].scrollIntoView({ block: "nearest", inline: "nearest" });
            } else {
                items[i].classList.remove("selected");
            }
        }
    }

    // Input Events
    input.addEventListener("keydown", (e) => {
        if (autocompleteDropdown.style.display === "flex") {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                // If selectedIndex is -1 (start), goes to 0.
                selectedIndex = (selectedIndex + 1) % visibleTags.length;
                updateSelection();
                return;
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (selectedIndex === -1) selectedIndex = visibleTags.length - 1;
                else selectedIndex = (selectedIndex - 1 + visibleTags.length) % visibleTags.length;
                updateSelection();
                return;
            } else if (e.key === "Enter" || e.key === "Tab") {
                if (selectedIndex >= 0) {
                    e.preventDefault();
                    selectAutocompleteItem(selectedIndex);
                    return;
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                closeAutocomplete();
                return;
            }
        }

        if (e.key === "Enter") {
            e.preventDefault();
            const val = input.value.trim();
            if (val) {
                // If autocomplete open and nothing selected, use input value?
                // Or if user typed "girl" and "1girl" is top result but not selected, do we auto-pick?
                // Let's stick to explicit: if no autocomplete selection, use typed text.

                const newChips = val.split(",").map(s => s.trim()).filter(s => s !== "");
                chips.push(...newChips);
                input.value = "";
                updateWidgetValue();
                renderChips();
                closeAutocomplete();
            }
        } else if (e.key === "Backspace" && input.value === "" && chips.length > 0) {
            // Remove last chip on backspace if input empty
            chips.pop();
            updateWidgetValue();
            renderChips();
            closeAutocomplete();
        }
    });

    input.addEventListener("input", (e) => {
        const val = input.value.trim();
        // If user types comma, create chip immediately
        if (val.includes(",")) {
            const parts = val.split(",");
            // The last part might be the start of a new tag, keep it?
            // Usually ComfyUI standard behavior is comma separates.
            // We'll take all parts except last one if it's empty? 
            // Logic: "tag1," -> ["tag1", ""] -> create tag1, clear input.
            // "tag1, tag2" -> create tag1, input becomes " tag2"?
            // Let's simplify: split all, if ends with comma or enter, consume all.
            // But 'input' event fires per char.

            // If comma is typed:
            // 1. consume everything before comma
            // 2. clear input
            // 3. if anything after comma, put it back in input?
            // Note: simpler to just use specific key handler or simple split.
            // Let's just create chips for everything before the last comma.
            // Actually, the original code handled Enter. 
            // Let's let the user type.
            // We only trigger autocomplete on text.

            // Check if comma exists
            if (input.value.includes(",")) {
                const parts = input.value.split(",");
                const toAdd = parts.slice(0, parts.length - 1).map(s => s.trim()).filter(s => s);
                if (toAdd.length > 0) {
                    chips.push(...toAdd);
                    updateWidgetValue();
                    renderChips();
                }
                input.value = parts[parts.length - 1]; // Keep last part
                closeAutocomplete();
                if (input.value.trim()) renderAutocomplete(input.value.trim());
                return;
            }
        }

        selectedIndex = 0; // Reset selection on new input
        renderAutocomplete(val);
    });

    input.addEventListener("blur", () => {
        // Delay closing to allow click events on autocomplete items to fire
        setTimeout(() => {
            closeAutocomplete();
            // Original blur logic: create chip from remaining text?
            const val = input.value.trim();
            if (val) {
                const newChips = val.split(",").map(s => s.trim()).filter(s => s !== "");
                chips.push(...newChips);
                input.value = "";
                updateWidgetValue();
                renderChips();
            }
        }, 200);
    });

    // Container dragover/drop
    let placeholder = document.createElement("div");
    placeholder.className = "comfy-chip-placeholder";

    container.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // Calculate insertion index and show placeholder
        const chipElements = Array.from(container.getElementsByClassName("comfy-chip"));
        // Filter out the dragged element itself if it's from this container to avoid weird jumping? 
        // Actually, standard practice is to just calculate position.

        let insertBeforeElement = null;
        for (const chipEl of chipElements) {
            if (chipEl.classList.contains("dragging")) continue; // Skip self
            const rect = chipEl.getBoundingClientRect();

            // If mouse is below this chip's row, this chip is technically "before" the mouse cursor in flow
            // Note: Use a small threshold if needed, but strict comparison usually works for non-overlapping rows
            if (e.clientY > rect.bottom) continue;

            // If mouse is above this chip's row, this chip is "after" the mouse cursor
            if (e.clientY < rect.top) {
                insertBeforeElement = chipEl;
                break;
            }

            // If overlapping vertically (same row), check horizontal position
            const midPoint = rect.left + rect.width / 2;
            if (e.clientX < midPoint) {
                insertBeforeElement = chipEl;
                break;
            }
        }

        if (insertBeforeElement) {
            // Check if placeholder is ALREADY there to avoid jitter/re-animation
            if (placeholder.nextElementSibling !== insertBeforeElement) {
                container.insertBefore(placeholder, insertBeforeElement);
            }
        } else {
            // Append
            // Check if already last (before input)
            if (placeholder.nextElementSibling !== input) {
                container.insertBefore(placeholder, input);
            }
        }
    });

    container.addEventListener("dragleave", (e) => {
        // Only remove if we left the container, not just entered a child
        if (!container.contains(e.relatedTarget)) {
            if (placeholder.parentNode === container) {
                container.removeChild(placeholder);
            }
        }
    });

    container.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent ComfyUI from handling this drop

        // Find placeholder index
        let dropIndex = -1;
        if (placeholder.parentNode === container) {
            // Calculate index skipping non-chips (like placeholder itself if we iterated? no, DOM order)
            // We need index in 'chips' array.
            // visual children: chip, chip, placeholder, chip, input...
            // index matches count of chips before placeholder.
            const siblings = Array.from(container.children);
            let count = 0;
            for (const child of siblings) {
                if (child === placeholder) {
                    dropIndex = count;
                    break;
                }
                if (child.classList.contains("comfy-chip") && !child.classList.contains("dragging")) {
                    count++;
                }
            }
            container.removeChild(placeholder);
        }

        const rawData = e.dataTransfer.getData("text/plain");
        if (!rawData) return;

        try {
            const data = JSON.parse(rawData);
            if (!data.text) return;

            const droppedText = data.text;
            const isSameWidget = (data.sourceWidgetName === widget.name && data.sourceNodeId === node.id);
            const sourceIndex = data.index;

            // Handle removal from source
            let sourceWidget = null;
            if (data.sourceNodeId === node.id) {
                sourceWidget = node.widgets.find(w => w.name === data.sourceWidgetName);
            } else {
                const sourceNode = app.graph.getNodeById(data.sourceNodeId);
                if (sourceNode) {
                    sourceWidget = sourceNode.widgets.find(w => w.name === data.sourceWidgetName);
                }
            }

            if (sourceWidget) {
                // Parse source chips
                // NOTE: If Same Widget, 'widget.value' might not have been updated if we didn't wait? 
                // Usually it's fine.
                let sourceChips = sourceWidget.value.split(",").map(s => s.trim()).filter(s => s !== "");

                // Remove item
                // Use sourceIndex if valid matches text, else find text
                if (sourceChips[sourceIndex] === droppedText) {
                    sourceChips.splice(sourceIndex, 1);
                } else {
                    const idx = sourceChips.indexOf(droppedText);
                    if (idx !== -1) sourceChips.splice(idx, 1);
                }

                // Update source
                const newSourceVal = sourceChips.join(", ");
                sourceWidget.value = newSourceVal;
                if (sourceWidget.callback) sourceWidget.callback(newSourceVal);

                // Refresh source UI
                if (sourceWidget.refreshChips) sourceWidget.refreshChips();
            }

            // Insert into destination
            // If dropIndex was not found (rare), append
            if (dropIndex === -1) dropIndex = chips.length;

            // Prepare destination chips
            // CAUTION: If isSameWidget, 'chips' array (this.chips) is ALREADY updated effectively by 'sourceWidget.refreshChips()' above?
            // YES. 'sourceWidget' === 'widget'. 'refreshChips' calls 'syncFromWidget' which rebuilds 'chips' from 'widget.value'.
            // So 'chips' now lacks the item. 
            // 'dropIndex' was calculated based on DOM *excluding* the dragging item (css class 'dragging').
            // The DOM still HAS the dragging item until 'renderChips' is called again?
            // Wait, sourceWidget.refreshChips() calls renderChips() which rebuilds DOM... 
            // So the dragging item disappears mid-drop if we refesh immediately? 
            // This might break the 'drop' event execution if the DOM node disppears?
            // JavaScript event continuation usually works, but DOM calculations might be stale.

            // To be safe:
            // The 'placeholder' calculation happened in dragOver (continuous).
            // The 'dropIndex' calculation happened at START of drop, BEFORE we touched sourceWidget.
            // So 'dropIndex' is correct relative to the visual state "before drop".
            // BUT, if isSameWidget, the "visual state" included the item being dragged (hidden or 0.5 opacity).
            // Our Drop Index calculation:
            // "count of chips before placeholder, excluding dragging item".
            // So if we moved item from Index 0 to Index 3.
            // Visual: [Dragging(0)], [1], [2], |Placeholder|, [3]
            // Count before P: [1], [2] -> 2.
            // So we insert at 2.
            // New Array: [1], [2], [Moved(0)], [3].
            // Seems correct.

            // If we moved item from Index 3 to Index 0.
            // Visual: |Placeholder|, [0], [1], [2], [Dragging(3)]
            // Count before P: 0.
            // New Array: [Moved(3)], [0], [1], [2].
            // Correct.

            // The only issue is if 'refreshChips()' updates 'chips' array.
            // We need to fetch the LATEST chips array (which has item removed) 
            // IF we did refresh.
            // OR we can operate on a local copy.

            // Since we called refreshChips(), 'chips' is updated to exclude the item.
            // So we can just splice insert.

            // We need to re-fetch chips incase refreshChips replaced the reference or updated it
            if (isSameWidget) {
                // chips is already updated by refreshChips()
            } else {
                // standard append
            }

            chips.splice(dropIndex, 0, droppedText);
            updateWidgetValue();
            renderChips();

        } catch (err) {
            console.error(err);
        }
    });

    // Attach refresh method to widget so others can trigger it
    widget.refreshChips = () => {
        syncFromWidget();
    };

    // Override the widget's default DOM drawing to show our container?
    // ComfyUI canvas widgets don't naturally stick DOM elements to the canvas node coordinates.
    // We have to manage the DOM element position manually in the draw loop OR 
    // inject it into the widget parameters if it supports a 'dom' element.
    //
    // However, looking at ComfyUI standard widgets:
    // They usually only create input elements when you CLICK them.
    //
    // For this request, a persistent "Chips" view is desired. 
    // This is best achieved by converting the widget to a custom DOM widget (like 'combo' but custom).
    //
    // BUT, we are modifying an EXISTING node type's behavior dynamically.
    //
    // Strategy:
    // We will HIDE the canvas drawing of the text.
    // We will append the 'container' to the ComfyUI document body.
    // We will update 'container' position in the node's `onDraw` or `onResize`.

    // 1. Initial Style
    container.style.position = "absolute";
    // container.style.display = "none"; // Initially hidden until computed
    document.body.appendChild(container); // Use body to ensure it's on top of everything

    // Track for global visibility loop
    const widgetEntry = { node, container };
    activeChipWidgets.add(widgetEntry);

    const originalOnRemove = node.onRemoved;
    node.onRemoved = function () {
        if (originalOnRemove) originalOnRemove.apply(this, arguments);
        container.remove();
        activeChipWidgets.delete(widgetEntry);
    };

    // Note: We removed the centralized onCollapse hook in favor of the global watchdog loop
    // which is more robust for "stuck" elements.



    // We need to manage visibility/position
    const updatePosition = () => {
        if (!node.graph || !app.canvas) {
            container.style.display = "none";
            return;
        }

        // Check if node is visible/on screen?
        // Basic visible check:
        // app.canvas.ds (scale)
        // app.canvas.offset (translate)

        // Find widget position relative to node
        // Widget 'y' is computed. We might need to guess or calculator.
        // ComfyUI widgets usually have 'last_y' property after draw?

        // Actually, let's look at `node.inputs` or `node.widgets`.
        // `widget.last_y` is often populated by `computeSize`.

        // Let's hook into the node's `onDraw` to get precise coordinates.
    };

    // Instead of complex onDraw hook (which runs every frame), 
    // let's follow the pattern of some custom nodes that use DOM overlays.
    // We need to override the widget's `draw` method.

    widget.draw = function (ctx, node, widgetWidth, y, widgetHeight) {
        // We don't draw the text.
        // We just update the DOM element position.

        // Transform canvas coordinates to screen coordinates
        // Canvas Transform: 
        // screenX = (nodeX + widgetX) * scale + offsetX
        const transform = ctx.getTransform();
        const scale = app.canvas.ds.scale;
        const offset = app.canvas.ds.offset;

        // Node position
        const nodeX = node.pos[0];
        const nodeY = node.pos[1];

        // Widget relative position
        // y is passed in.

        // Calculate screen position
        // This is tricky because `ctx` already has transforms applied for the Node?
        // Usually ComfyUI calls widget.draw with context translated to node content area.

        // Actually, ctx is translated to (node.pos[0], node.pos[1]) usually? 
        // No, LiteGraph usually handles this.

        // Let's use `app.canvas.convertOffsetToCanvas(x,y)` inverted?

        // Simpler: Use `node.getBoundingClientRect()` equivalent? No.

        // Let's try to calculate from `transform`.
        // transform.e -> translation X (screen)?? depends on browser.
        // Better to use `app.canvas.convertPosToDOM([x, y])` if available? 
        // No, but we can calculate:
        // screenX = (node.pos[0] + offset[0]) * scale
        // screenY = (node.pos[1] + y + offset[1]) * scale

        // Actually: 
        // output_x = (x * state.scale) + state.offset_x 

        // Correct logic for LiteGraph canvas:
        const x = node.pos[0]; // Node left
        const w = node.size[0]; // Node width
        // y is the relative Y of the widget start inside the node

        // We want the DOM element to cover the widget area.
        // Widget area width is roughly `w - 20`? `widgetWidth` is passed.

        // DOM coords:
        // canvas origin in window is usually 0,0 (unless embedded).

        const canvasOrigin = app.canvas.canvas.getBoundingClientRect(); // relative to viewport

        const zoom = app.canvas.ds.scale;
        const panX = app.canvas.ds.offset[0];
        const panY = app.canvas.ds.offset[1];

        // Pos on canvas
        const absoluteX = x;
        const absoluteY = y + node.pos[1];

        // Pos on screen
        const screenX = (absoluteX + panX) * zoom + canvasOrigin.left;
        const screenY = (absoluteY + panY) * zoom + canvasOrigin.top;

        // We set the Unscaled width, and let transform scale it
        container.style.width = `${widgetWidth}px`;

        container.style.left = `${screenX}px`;
        container.style.top = `${screenY}px`;

        // Visibility check
        const isHidden = (node.flags && node.flags.collapsed);
        container.style.display = isHidden ? "none" : "flex";

        container.style.transformOrigin = "0 0";
        container.style.transform = `scale(${zoom})`;

        // IMPORTANT: If we grow in height, we need to tell the node to grow.
        // We can measure the container's height and update `widget.computedHeight`?

        const clientHeight = container.offsetHeight;
        // We need to divide by zoom if we scaled it?
        // No, if we scaled with transform, offsetHeight is the unscaled height? 
        // Wait, 'scale' transform doesn't change layout flow size usually.

        // Logic:
        // 1. We require a certain height.
        // 2. We tell the node widget needs X height.
        // 3. Node redraws and gives us X height.

        // This is a loop.
        // `widget.computeSize` is called by LiteGraph.

    }

    // Override computeSize to reserve space based on our content
    widget.computeSize = function (width) {
        // We need to know how high our content IS.
        // But we can't easily query the hidden/detached DOM for "how high would you be at width W?".
        // Estimate:
        // Basic height = 50.
        // If we have many chips, maybe more.

        // Let's rely on the container's current scrollHeight/offsetHeight if it's attached.
        // Default to a min height.

        let h = 50;
        if (container && container.offsetHeight) {
            h = container.offsetHeight;
        }
        return [width, h];
    }

    // We need to continually resize the node if the container grows?
    // Use ResizeObserver on the container.
    const observer = new ResizeObserver(() => {
        if (!node.size) return;

        // node.computeSize() returns the MINIMUM size required by widgets.
        const minSize = node.computeSize();

        // Use current width, but ensure it's at least minWidth from computeSize
        const currentWidth = node.size[0];
        const newWidth = Math.max(currentWidth, minSize[0]);

        // Update height to fit content (minSize[1] will typically include the height we requested in computeSize)
        // If the current height is different from needed, OR current width is less than min width, resize.

        // Note: We should check if we really need to resize to avoid loop.
        if (Math.abs(node.size[1] - minSize[1]) > 5 || currentWidth < minSize[0]) {
            node.setSize([newWidth, minSize[1]]);
            node.setDirtyCanvas(true, true);
        }
    });

    observer.observe(container);

}
