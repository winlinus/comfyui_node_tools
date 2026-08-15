# Development helpers for iterating on this node inside a live ComfyUI install.
#
# Two ways to get the code where ComfyUI can see it:
#
#   make link     symlink it once, then never sync again  (recommended)
#   make deploy   copy the working tree over              (if you dislike symlinks)
#
# Override the install location if it ever moves:
#   make deploy COMFY_DIR=/somewhere/else/ComfyUI

COMFY_DIR ?= $(HOME)/ComfyUI-Installs/ComfyUI/ComfyUI
NODE_NAME := comfyui-prompt-editor
TARGET    := $(COMFY_DIR)/custom_nodes/$(NODE_NAME)

# templates.json is your saved templates: gitignored, and the only file in the
# install that is not reproducible from this repo. Never let a sync delete it.
RSYNC_EXCLUDES := \
	--exclude '.git/' \
	--exclude '.claude/' \
	--exclude '__pycache__/' \
	--exclude '*.pyc' \
	--exclude 'templates.json'

.DEFAULT_GOAL := help

.PHONY: help
help:
	@echo "make link     - symlink this repo into ComfyUI's custom_nodes (one-time)"
	@echo "make deploy   - copy this repo into ComfyUI's custom_nodes"
	@echo "make unlink   - remove the symlink"
	@echo "make status   - show what is currently installed"
	@echo ""
	@echo "  target: $(TARGET)"
	@echo ""
	@echo "ComfyUI must be restarted after either link or deploy - it imports"
	@echo "custom nodes once at startup. Browser-side JS also needs a hard reload."

.PHONY: check-comfy
check-comfy:
	@test -d "$(COMFY_DIR)/custom_nodes" || { \
		echo "ERROR: $(COMFY_DIR)/custom_nodes not found."; \
		echo "Pass the right path:  make $(MAKECMDGOALS) COMFY_DIR=/path/to/ComfyUI"; \
		exit 1; \
	}

.PHONY: link
link: check-comfy
	@if [ -L "$(TARGET)" ]; then \
		echo "Already a symlink -> $$(readlink "$(TARGET)")"; \
		echo "Nothing to do. Edits here are live."; \
	elif [ -e "$(TARGET)" ]; then \
		echo "$(TARGET) exists and is a real directory, not a symlink."; \
		echo ""; \
		echo "Replacing it will delete that copy. Anything not in this repo is lost -"; \
		echo "in practice that means templates.json, if you have saved any templates."; \
		echo ""; \
		if [ -f "$(TARGET)/templates.json" ]; then \
			echo "  FOUND: $(TARGET)/templates.json  <- rescue this first"; \
			echo "  cp '$(TARGET)/templates.json' '$(CURDIR)/templates.json'"; \
			echo ""; \
		fi; \
		echo "When you are happy to lose it:"; \
		echo "  rm -rf '$(TARGET)' && make link"; \
		exit 1; \
	else \
		ln -s "$(CURDIR)" "$(TARGET)"; \
		echo "Linked: $(TARGET) -> $(CURDIR)"; \
		echo "From now on your edits are live. Restart ComfyUI to pick this up."; \
	fi

.PHONY: unlink
unlink:
	@if [ -L "$(TARGET)" ]; then \
		rm "$(TARGET)"; \
		echo "Removed symlink $(TARGET)"; \
	elif [ -e "$(TARGET)" ]; then \
		echo "$(TARGET) is a real directory, not a symlink. Refusing to delete it."; \
		exit 1; \
	else \
		echo "Nothing at $(TARGET)"; \
	fi

.PHONY: deploy
deploy: check-comfy
	@if [ -L "$(TARGET)" ]; then \
		echo "$(TARGET) is a symlink - your edits are already live, deploy is a no-op."; \
		exit 0; \
	fi
	@mkdir -p "$(TARGET)"
	@rsync -a --delete $(RSYNC_EXCLUDES) "$(CURDIR)/" "$(TARGET)/"
	@echo "Deployed to $(TARGET)"
	@echo "Restart ComfyUI, then hard-reload the browser (Cmd+Shift+R) for the JS."

.PHONY: status
status:
	@echo "source: $(CURDIR)"
	@echo "target: $(TARGET)"
	@if [ -L "$(TARGET)" ]; then \
		echo "state : symlink -> $$(readlink "$(TARGET)")"; \
	elif [ -d "$(TARGET)" ]; then \
		echo "state : real directory (needs 'make deploy' after every change)"; \
		echo ""; \
		echo "differences:"; \
		diff -rq "$(CURDIR)" "$(TARGET)" \
			--exclude=.git --exclude=.claude --exclude=__pycache__ --exclude=templates.json \
			2>/dev/null | sed 's/^/  /' || true; \
	else \
		echo "state : not installed"; \
	fi
