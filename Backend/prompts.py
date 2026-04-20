import random
from config import DEFAULT_POSITIVE_PREFIX, DEFAULT_NEGATIVE_PROMPT

def build_positive_prompt(subject="1girl", character="", series="", artist="", general_tags="", natural_language=""):
    """Builds a positive prompt following styling rules."""
    tags = list(DEFAULT_POSITIVE_PREFIX)
    
    if subject: tags.append(subject)
    if character: tags.append(character)
    if series: tags.append(series)
    if artist: tags.append(f"@{artist}") 
    if general_tags: tags.append(general_tags)
    
    prompt = ", ".join(tags)
    
    if natural_language:
        prompt = f"{prompt}. {natural_language}"
        
    return prompt

def build_negative_prompt(extra_tags=""):
    """Builds a negative prompt."""
    base = DEFAULT_NEGATIVE_PROMPT
    if extra_tags:
        return f"{base}, {extra_tags}"
    return base

def build_dynamic_prompt(templates, dictionary):
    """Generates a random prompt using provided templates and dictionary."""
    template = random.choice(templates)
    chosen_character = ""
    
    for key, options in dictionary.items():
        if key in template:
            val = random.choice(options)
            if key == "CHARACTER":
                chosen_character = val.split(" (")[0].replace(" from ", "_").strip()
            template = template.replace(key, val)
            
    prefix = ", ".join(DEFAULT_POSITIVE_PREFIX)
    prompt = f"{prefix}. {template}"
    return prompt, chosen_character