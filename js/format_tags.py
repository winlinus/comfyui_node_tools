import json
import os

# Get directory of current script to locate tags.json securely
base_dir = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(base_dir, 'tags.json')

try:
    if not os.path.exists(path):
        print(f"Error: {path} not found")
        exit(1)
        
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        
    print(f"Successfully formatted {path}")
except Exception as e:
    print(f"Error: {e}")
