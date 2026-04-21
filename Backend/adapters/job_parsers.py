from __future__ import annotations

"""
AI Studio — Job Parser Strategy Pattern
-----------------------------------------
Implements the Strategy Pattern for loading job definitions from different sources.

Adding a new source type (e.g. YAML, database) requires only:
  1. Create a new class implementing IJobParser
  2. Register it in JobLoader._parsers

Open/Closed Principle: existing parsers never need modification.
"""

import csv
import io
import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path

logger = logging.getLogger(__name__)


class IJobParser(ABC):
    """
    Strategy interface. All job parsers must return a list of dicts
    with the standard job fields (subject, character, series, etc.).
    Liskov Substitution: any parser can replace any other transparently.
    """

    @abstractmethod
    def parse(self, source: bytes | str | Path | list) -> list[dict]:
        """Parse a source and return a normalized list of job dictionaries."""
        raise NotImplementedError


class JSONJobParser(IJobParser):
    """Parses a JSON file or JSON string into job dicts."""

    def parse(self, source: bytes | str | Path | list) -> list[dict]:
        if isinstance(source, Path) or (isinstance(source, str) and Path(source).exists()):
            with open(source, "r", encoding="utf-8") as f:
                data = json.load(f)
        elif isinstance(source, bytes):
            data = json.loads(source.decode("utf-8"))
        elif isinstance(source, str):
            data = json.loads(source)
        else:
            data = source  # Already a dict/list

        return data if isinstance(data, list) else [data]


class CSVJobParser(IJobParser):
    """Parses a CSV file or CSV bytes/string into job dicts."""

    def parse(self, source: bytes | str | Path | list) -> list[dict]:
        if isinstance(source, Path) or (isinstance(source, str) and Path(str(source)).exists()):
            with open(source, "r", encoding="utf-8") as f:
                content = f.read()
        elif isinstance(source, bytes):
            content = source.decode("utf-8")
        else:
            content = str(source)

        reader = csv.DictReader(io.StringIO(content))
        jobs: list[dict] = []
        for row in reader:
            # Strip whitespace from all keys and non-empty values
            cleaned = {
                k.strip(): v.strip()
                for k, v in row.items()
                if k and v and v.strip()
            }
            if cleaned:
                jobs.append(cleaned)

        logger.info(f"CSVJobParser: parsed {len(jobs)} rows")
        return jobs


class RawListJobParser(IJobParser):
    """
    Pass-through parser for an already-constructed list of dicts.
    Used when the API receives jobs directly as JSON payload.
    """

    def parse(self, source: bytes | str | Path | list) -> list[dict]:
        if not isinstance(source, list):
            raise ValueError("RawListJobParser expects a list of dicts")
        return list(source)


class JobLoader:
    """
    Context class that selects and invokes the correct IJobParser strategy.
    Dependency Inversion: consumers depend on JobLoader (abstraction),
    not on specific parser implementations.
    """

    _parsers: dict[str, type[IJobParser]] = {
        ".json": JSONJobParser,
        ".csv": CSVJobParser,
    }

    @classmethod
    def from_file(cls, filepath: str | Path) -> list[dict]:
        """Load jobs from a local file (auto-detects CSV vs JSON by extension)."""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"Job file not found: {filepath}")

        parser_class = cls._parsers.get(path.suffix.lower())
        if not parser_class:
            raise ValueError(
                f"Unsupported file format: '{path.suffix}'. "
                f"Supported: {list(cls._parsers.keys())}"
            )

        logger.info(f"Loading jobs from file: {path} using {parser_class.__name__}")
        return parser_class().parse(path)

    @classmethod
    def from_upload(cls, content: bytes, filename: str) -> list[dict]:
        """
        Load jobs from an uploaded file's raw bytes.
        Platform-agnostic: no temp file written to disk.
        """
        suffix = Path(filename).suffix.lower()
        parser_class = cls._parsers.get(suffix)
        if not parser_class:
            raise ValueError(
                f"Unsupported upload format: '{suffix}'. "
                f"Supported: {list(cls._parsers.keys())}"
            )

        logger.info(f"Parsing uploaded file '{filename}' using {parser_class.__name__}")
        return parser_class().parse(content)

    @classmethod
    def from_list(cls, jobs: list[dict]) -> list[dict]:
        """Load jobs from an already-constructed Python list (API payloads)."""
        return RawListJobParser().parse(jobs)

    @classmethod
    def register_parser(cls, extension: str, parser_class: type[IJobParser]) -> None:
        """
        Register a new parser strategy at runtime.
        Open/Closed: extend without modifying this class.

        Example:
            JobLoader.register_parser(".yaml", YamlJobParser)
        """
        cls._parsers[extension.lower()] = parser_class
        logger.info(f"Registered new parser: {extension} → {parser_class.__name__}")
