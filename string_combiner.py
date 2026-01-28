class DynamicStringCombiner:
    @classmethod
    def INPUT_TYPES(s):
        inputs = {
            "required": {},
            "optional": {}
        }
        
        # Add string_1 to string_10 as widgets first (to appear at top)
        for i in range(1, 11):
            inputs["required"][f"string_{i}"] = ("STRING", {"default": "", "multiline": True})

        # Add delimiter and remove_empty at the bottom
        inputs["required"]["delimiter"] = ("STRING", {"default": ",", "multiline": False})
        inputs["required"]["remove_empty"] = ("BOOLEAN", {"default": True})
            
        return inputs

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("combined_string",)
    FUNCTION = "combine"
    CATEGORY = "string_tools"

    def combine(self, delimiter, remove_empty, **kwargs):
        strings_to_combine = []
        
        # Iterate through string_1 to string_10
        for i in range(1, 11):
            key = f"string_{i}"
            value = kwargs.get(key, None)
            
            if value is not None:
                # If remove_empty is True, strip whitespace and check if empty
                if remove_empty:
                    value = value.strip()
                    if value:  # Only add if not empty string after strip
                         strings_to_combine.append(value)
                else:
                    # If remove_empty is False, just add the value (even if it's empty or just whitespace? 
                    # Prompt says: "If remove_empty is true, must automatically delete whitespace (strip).
                    # Logic: "Join all strings that have content". 
                    # Assume if remove_empty is False, we keep them as is. 
                    strings_to_combine.append(value)
        
        result = delimiter.join(strings_to_combine)
        return (result,)
