from __future__ import annotations
from typing import Any, Optional

"""
AI Studio — Prompt Engine
--------------------------
Handles all string manipulation, tag ordering, and NLP merging logic.
Extracted from the original prompts.py into a dedicated core module.

Tag Order (Pony/Danbooru convention):
  [quality/meta] → [subject] → [character] → [series] → [artist] → [general_tags]
  → [natural_language]
"""

import random
from config import settings


def _get_prefix_list() -> list[str]:
    """Parse the comma-separated prefix string from settings."""
    return [t.strip() for t in settings.default_positive_prefix.split(",") if t.strip()]


def build_positive_prompt(
    subject: str = "1girl",
    character: str = "",
    series: str = "",
    artist: str = "",
    general_tags: str = "",
    natural_language: str = "",
) -> str:
    """
    Builds a positive prompt following Danbooru/Pony tagging conventions.

    Arguments:
        subject:          Primary subject tag (e.g. '1girl', '1boy')
        character:        Named character (e.g. 'Fern', 'Rem (Re:Zero)')
        series:           Source material (e.g. 'Sousou no Frieren')
        artist:           Artist tag — @ prefix added automatically if missing
        general_tags:     Comma-separated scene/aesthetic tags
        natural_language: Free-form English description appended after tags
    """
    tags: list[str] = list(_get_prefix_list())

    if subject:
        tags.append(subject)
    if character:
        tags.append(character)
    if series:
        tags.append(series)
    if artist:
        # Enforce @ prefix for artist trigger words
        a = artist.strip()
        tags.append(a if a.startswith("@") else f"@{a}")
    if general_tags:
        tags.append(general_tags)

    prompt = ", ".join(tags)

    if natural_language:
        # Natural language appended after a period separator
        prompt = f"{prompt}. {natural_language.strip()}"

    return prompt


def build_negative_prompt(extra_tags: str = "") -> str:
    """
    Builds the negative prompt.

    Arguments:
        extra_tags: Additional negative tags to append (comma-separated)
    """
    base = settings.default_negative_prompt
    if extra_tags:
        return f"{base}, {extra_tags.strip()}"
    return base


def build_dynamic_prompt(
    templates: list[str],
    dictionary: dict[str, list[str]],
    template_index: Optional[int] = None,
) -> tuple[str, str]:
    """
    Generates a random prompt using template substitution.

    Template variables (e.g. CHARACTER, ARTIST) are replaced with random
    values drawn from the dictionary. Template variables must be uppercase
    and match dictionary keys exactly.

    Arguments:
        templates:       List of template strings
        dictionary:      Key→[options] mapping
        template_index:  If specified, use this template index instead of random

    Returns:
        (synthesized_prompt, chosen_character_name)
    """
    if template_index is not None and 0 <= template_index < len(templates):
        template = templates[template_index]
    else:
        template = random.choice(templates)

    chosen_character = ""

    for key, options in dictionary.items():
        if key in template:
            val = random.choice(options)
            if key == "CHARACTER":
                # Extract clean character name for use as filename prefix
                chosen_character = val.split(" (")[0].replace(" from ", "_").strip()
            template = template.replace(key, val)

    prefix = ", ".join(_get_prefix_list())
    prompt = f"{prefix}. {template}"
    return prompt, chosen_character


def sanitize_tag(tag: str) -> str:
    """
    Normalize a tag to Danbooru conventions:
    - lowercase
    - spaces instead of underscores (except score tags)
    - stripped whitespace
    """
    tag = tag.strip()
    if tag.startswith("score_") or tag.startswith("@"):
        return tag.lower()
    return tag.lower().replace("_", " ")


def merge_prompts(base: str, additions: list[str]) -> str:
    """
    Merge additional tags into an existing prompt string, avoiding duplicates.
    """
    existing = {t.strip().lower() for t in base.split(",")}
    new_tags = [t for t in additions if t.strip().lower() not in existing]
    if not new_tags:
        return base
    return base + ", " + ", ".join(new_tags)
