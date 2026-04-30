"""Dump OpenAPI schema to stdout. Used by verify.sh to detect contract drift."""

from __future__ import annotations

import json
import sys

from app.main import app


def main() -> None:
    json.dump(app.openapi(), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
