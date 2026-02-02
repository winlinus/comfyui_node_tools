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
        # Global templates: we only care about template_name and content
        template_name = data.get("template_name")
        content = data.get("content")

        if not template_name:
            return web.Response(status=400, text="Missing template_name")

        templates = load_templates()
        
        # Check if templates is in old format (nested dicts), if so, migrates or just starts fresh?
        # Let's support flat format. If we see nested, we might want to flatten or just start over.
        # For simplicity in this refactor, we assume we are writing flat keys.
        # To avoid breaking if file has old data, we just write to it. Mixed data might be messy but acceptable for dev.
        # Actually better to enforce flat dict.
        
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
        # Ignore query params, return all
        templates = load_templates()
        
        # Filter out legacy nested data if possible? 
        # Or just return everything. The frontend will display keys.
        # If user has old data { "node_1": ... }, it will show up as a template named "node_1".
        # This is fine for migration.
        
        return web.json_response(templates)
        
    except Exception as e:
        print(f"[StringTools] Exception in get_templates: {e}")
        return web.Response(status=500, text=str(e))

@server.PromptServer.instance.routes.post("/string_tools/delete_template")
async def delete_template(request):
    try:
        data = await request.json()
        template_name = data.get("template_name")

        if not template_name:
            return web.Response(status=400, text="Missing template_name")

        templates = load_templates()
        
        if template_name in templates:
            del templates[template_name]
            save_templates(templates)
            return web.json_response({"status": "success"})
        
        return web.Response(status=404, text="Template not found")
            
    except Exception as e:
        print(f"[StringTools] Exception in delete_template: {e}")
        return web.Response(status=500, text=str(e))

