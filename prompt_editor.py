import json

# The editor's state lives in a single JSON widget (`blocks`), rendered entirely
# by js/dynamic_chips.js. Python never needs to know how many blocks there are.
# See docs/adr/0002-prompt-state-as-single-json-widget.md
STATE_VERSION = 1

DEFAULT_BLOCK_NAMES = ["品質", "角色", "人數", "體型", "髮", "服裝", "動作", "場景"]


def default_state():
    return {
        "version": STATE_VERSION,
        "blocks": [
            {"name": name, "enabled": True, "chips": []}
            for name in DEFAULT_BLOCK_NAMES
        ],
    }


def parse_blocks(raw):
    """Read the blocks list out of the widget value. Never raises."""
    if isinstance(raw, dict):
        state = raw
    else:
        try:
            state = json.loads(raw) if raw else None
        except (TypeError, ValueError) as e:
            print(f"[PromptEditor] Could not parse blocks widget, treating as empty: {e}")
            return []

    if not isinstance(state, dict):
        return []

    blocks = state.get("blocks")
    return blocks if isinstance(blocks, list) else []


class PromptEditor:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # Not multiline: this widget is hidden by the frontend and only
                # ever written to by it. Single-line keeps it canvas-drawn, which
                # is what makes it hideable.
                "blocks": ("STRING", {"default": json.dumps(default_state(), ensure_ascii=False)}),
                "delimiter": ("STRING", {"default": ",", "multiline": False}),
                "remove_empty": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                # Connect a CLIP to get CONDITIONING straight out of this node and
                # skip the separate CLIPTextEncode. Leave it unconnected and the
                # node behaves exactly as before.
                # See docs/adr/0004-node-outputs-string-and-optional-conditioning.md
                "clip": ("CLIP",),
            },
        }

    RETURN_TYPES = ("STRING", "CONDITIONING")
    RETURN_NAMES = ("combined_string", "conditioning")
    FUNCTION = "combine"
    CATEGORY = "prompt_editor"

    def combine(self, blocks, delimiter, remove_empty, clip=None):
        parts = []

        for block in parse_blocks(blocks):
            if not isinstance(block, dict):
                continue
            if not block.get("enabled", True):
                continue

            chips = block.get("chips")
            if not isinstance(chips, list):
                continue

            for chip in chips:
                if not isinstance(chip, str):
                    continue
                if remove_empty:
                    chip = chip.strip()
                    if not chip:
                        continue
                parts.append(chip)

        text = delimiter.join(parts)

        conditioning = None
        if clip is not None:
            # Mirrors ComfyUI's own CLIPTextEncode.
            conditioning = clip.encode_from_tokens_scheduled(clip.tokenize(text))

        return (text, conditioning)
