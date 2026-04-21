from __future__ import annotations

"""
AI Studio — Dictionary API Routes
------------------------------------
Endpoints:
  GET  /api/dictionaries              — Fetch all categories + templates from a dict file
  GET  /api/dictionaries/files        — List all available dict files in Jobs dir
  GET  /api/dictionaries/{category}  — Terms for a single category
  POST /api/dictionaries/{category}  — Add a new term to a category (file-backed in Phase 1)
  DELETE /api/dictionaries/{category}/{term} — Remove a term
"""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from models.schemas import DictionariesResponse

router = APIRouter(prefix="/api", tags=["Dictionaries"])
logger = logging.getLogger(__name__)


def _load_dict(dict_file: str) -> dict:
    """Load and return the raw dictionary JSON. Raises 404 on missing file."""
    path = Path(settings.jobs_dir) / dict_file
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Dictionary file not found: '{dict_file}'",
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_dict(dict_file: str, data: dict) -> None:
    """Persist a modified dictionary back to disk."""
    path = Path(settings.jobs_dir) / dict_file
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── List Available Files ───────────────────────────────────────────────────────

@router.get(
    "/dictionaries/files",
    summary="List all dictionary JSON files in the Jobs directory",
)
async def list_dictionary_files() -> dict:
    jobs_dir = Path(settings.jobs_dir)
    if not jobs_dir.exists():
        return {"files": [], "jobs_dir": str(jobs_dir)}

    files = sorted(f.name for f in jobs_dir.glob("*.json"))
    return {"files": files, "jobs_dir": str(jobs_dir.resolve())}


# ── Full Dictionary ────────────────────────────────────────────────────────────

@router.get(
    "/dictionaries",
    response_model=DictionariesResponse,
    summary="Fetch all categories and templates from a dictionary file",
)
async def get_dictionaries(
    dict_file: str = "demodictionary.json",
) -> DictionariesResponse:
    """
    Returns the full dictionary used for populating UI dropdowns.
    The frontend reads this once on mount via React Query.
    Redis caching will be added in Phase 2.
    """
    data = _load_dict(dict_file)

    return DictionariesResponse(
        categories=data.get("DYNAMIC_DICTIONARY", {}),
        templates=data.get("DYNAMIC_TEMPLATES", []),
    )


# ── Single Category ────────────────────────────────────────────────────────────

@router.get(
    "/dictionaries/{category}",
    summary="Get all terms for a single category",
)
async def get_category_terms(
    category: str,
    dict_file: str = "demodictionary.json",
) -> dict:
    data = _load_dict(dict_file)
    dictionary = data.get("DYNAMIC_DICTIONARY", {})

    category_upper = category.upper()
    if category_upper not in dictionary:
        raise HTTPException(
            status_code=404,
            detail=f"Category '{category_upper}' not found. "
                   f"Available: {list(dictionary.keys())}",
        )

    return {"category": category_upper, "terms": dictionary[category_upper]}


# ── Add Term ───────────────────────────────────────────────────────────────────

class AddTermRequest(BaseModel):
    term: str
    dict_file: str = "demodictionary.json"


@router.post(
    "/dictionaries/{category}",
    summary="Add a new term to a dictionary category",
)
async def add_dictionary_term(category: str, req: AddTermRequest) -> dict:
    """
    Adds a term to the specified category and persists to the JSON file.
    Phase 2: this will write to the PostgreSQL dictionary_terms table.
    """
    data = _load_dict(req.dict_file)
    dictionary: dict = data.setdefault("DYNAMIC_DICTIONARY", {})
    category_upper = category.upper()

    if category_upper not in dictionary:
        # Create new category on the fly (Open/Closed: no UI code change needed)
        dictionary[category_upper] = []

    term = req.term.strip()
    if not term:
        raise HTTPException(status_code=400, detail="Term cannot be empty")

    if term in dictionary[category_upper]:
        raise HTTPException(
            status_code=409,
            detail=f"Term '{term}' already exists in category '{category_upper}'",
        )

    dictionary[category_upper].append(term)
    _save_dict(req.dict_file, data)

    logger.info(f"Added term '{term}' to category '{category_upper}' in '{req.dict_file}'")
    return {
        "message": f"Term '{term}' added to '{category_upper}'",
        "terms": dictionary[category_upper],
    }


# ── Delete Term ────────────────────────────────────────────────────────────────

@router.delete(
    "/dictionaries/{category}/{term}",
    summary="Remove a term from a dictionary category",
)
async def delete_dictionary_term(
    category: str,
    term: str,
    dict_file: str = "demodictionary.json",
) -> dict:
    data = _load_dict(dict_file)
    dictionary: dict = data.get("DYNAMIC_DICTIONARY", {})
    category_upper = category.upper()

    if category_upper not in dictionary:
        raise HTTPException(status_code=404, detail=f"Category '{category_upper}' not found")

    if term not in dictionary[category_upper]:
        raise HTTPException(
            status_code=404,
            detail=f"Term '{term}' not found in '{category_upper}'",
        )

    dictionary[category_upper].remove(term)
    _save_dict(dict_file, data)

    logger.info(f"Removed term '{term}' from '{category_upper}' in '{dict_file}'")
    return {
        "message": f"Term '{term}' removed from '{category_upper}'",
        "remaining": len(dictionary[category_upper]),
    }


# ── Template Management ────────────────────────────────────────────────────────

class AddTemplateRequest(BaseModel):
    template: str
    dict_file: str = "demodictionary.json"


@router.post("/dictionaries/templates/add", summary="Add a new dynamic template string")
async def add_template(req: AddTemplateRequest) -> dict:
    data = _load_dict(req.dict_file)
    templates: list = data.setdefault("DYNAMIC_TEMPLATES", [])

    if req.template in templates:
        raise HTTPException(status_code=409, detail="Template already exists")

    templates.append(req.template)
    _save_dict(req.dict_file, data)

    return {"message": "Template added", "total": len(templates)}
