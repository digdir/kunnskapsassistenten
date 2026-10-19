# -*- coding: utf-8 -*-
"""Blinding of model outputs.

Each (model, repetition) is stored under a hash id. The link between hash id
and model can only be written to disk after scoring is marked as finished.
"""

import hashlib
import json
import secrets
from pathlib import Path
from typing import Dict, Optional, Tuple


class BlindKey:
    """Keeps the link between blind ids and (model, repetition) in memory."""

    def __init__(self, salt: Optional[str] = None) -> None:
        """
        Initialize an empty key.

        Args:
            salt: Secret salt for the hash ids. A random salt is drawn when
                omitted, so ids cannot be recomputed from model names.
        """
        self._salt = salt if salt is not None else secrets.token_hex(16)
        self._links: Dict[str, Tuple[str, int]] = {}
        self._scored = False

    def blind_id(self, model_name: str, repetition: int) -> str:
        """
        Return the blind id for one repetition of one model.

        Args:
            model_name: Name of the model in the config.
            repetition: Repetition number, starting at 1.

        Returns:
            Twelve character hash id.
        """
        digest = hashlib.sha256(
            f"{self._salt}|{model_name}|{repetition}".encode("utf-8")
        ).hexdigest()[:12]
        self._links[digest] = (model_name, repetition)
        return digest

    def mark_scored(self) -> None:
        """Record that scoring is finished, which allows the key to be revealed."""
        self._scored = True

    def reveal(self) -> Dict[str, Tuple[str, int]]:
        """
        Return the link between blind ids and (model, repetition).

        Returns:
            Mapping from blind id to model name and repetition.

        Raises:
            RuntimeError: If scoring is not finished.
        """
        if not self._scored:
            raise RuntimeError("The blind key cannot be revealed before scoring")
        return dict(self._links)

    def write(self, path: Path) -> None:
        """
        Write the key to disk.

        Args:
            path: Output path for the JSON file.

        Raises:
            RuntimeError: If scoring is not finished.
        """
        links = self.reveal()
        payload = {
            blind_id: {"model": model_name, "repetition": repetition}
            for blind_id, (model_name, repetition) in sorted(links.items())
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
