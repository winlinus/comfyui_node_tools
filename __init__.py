from .string_combiner import DynamicStringCombiner

NODE_CLASS_MAPPINGS = {
    "DynamicStringCombiner": DynamicStringCombiner
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DynamicStringCombiner": "Dynamic String Combiner"
}

WEB_DIRECTORY = "./js"

import server
import aiohttp
from aiohttp import web
import json
import os

TEMPLATES_FILE = os.path.join(os.path.dirname(__file__), "templates.json")

def load_templates():
    if not os.path.exists(TEMPLATES_FILE):
        return {}
    try:
        with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[StringTools] Error loading templates: {e}")
        return {}

def save_templates(data):
    try:
        with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[StringTools] Error saving templates: {e}")
        return False

@server.PromptServer.instance.routes.post("/string_tools/save_template")
async def save_template(request):
    try:
        data = await request.json()
        print(f"[StringTools] DEBUG - Save Template Request: {data}")
        template_name = data.get("template_name")
        content = data.get("content")
        category = data.get("category", "").strip()

        if not template_name:
            return web.Response(status=400, text="Missing template_name")

        templates = load_templates()
        
        if category:
            if category not in templates:
                templates[category] = {}
            
            # Handle collision: Category name exists but is a flat template (string)
            if not isinstance(templates[category], dict):
                print(f"[StringTools] Migrating flat template '{category}' to folder '{category}'")
                # Move the existing flat template inside the new folder
                # We use the category name as the template name for the old content
                migrated_content = templates[category]
                templates[category] = {
                    category: migrated_content
                }
            
            templates[category][template_name] = content
        else:
            # Root level save
            # Check if name conflicts with a folder
            if template_name in templates and isinstance(templates[template_name], dict):
                 return web.Response(status=400, text=f"Name conflict: '{template_name}' is already a folder. Please choose a different name.")
            templates[template_name] = content
        
        if save_templates(templates):
            return web.json_response({"status": "success"})
        else:
            return web.Response(status=500, text="Failed to save template")
            
    except Exception as e:
        print(f"[StringTools] Exception in save_template: {e}")
        return web.Response(status=500, text=str(e))

@server.PromptServer.instance.routes.get("/string_tools/get_templates")
async def get_templates(request):
    try:
        templates = load_templates()
        return web.json_response(templates)
    except Exception as e:
        print(f"[StringTools] Exception in get_templates: {e}")
        return web.Response(status=500, text=str(e))

@server.PromptServer.instance.routes.post("/string_tools/delete_template")
async def delete_template(request):
    try:
        data = await request.json()
        template_name = data.get("template_name")
        category = data.get("category")
        if category:
            category = str(category).strip()
        else:
            category = ""

        if not template_name:
            return web.Response(status=400, text="Missing template_name")

        templates = load_templates()
        
        if category:
            if category in templates and isinstance(templates[category], dict):
                if template_name in templates[category]:
                    del templates[category][template_name]
                    # Validated: If folder empty, remove it? Optional but cleaner.
                    if not templates[category]:
                        del templates[category]
                    save_templates(templates)
                    return web.json_response({"status": "success"})
        else:
            if template_name in templates:
                del templates[template_name]
                save_templates(templates)
                return web.json_response({"status": "success"})
        
        return web.Response(status=404, text="Template not found")
            
    except Exception as e:
        print(f"[StringTools] Exception in delete_template: {e}")
        return web.Response(status=500, text=str(e))

