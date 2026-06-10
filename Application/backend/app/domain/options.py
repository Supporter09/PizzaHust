"""A8 – option-selection rules for the generic options model.

Pure domain logic: given the options available to a dish (already filtered to
the dish's enabled set) and the customer's selected ids, enforce group rules.
Callers dedupe ids before calling.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class SelectableOption:
    option_id: int
    group_id: int
    group_name: str
    select_type: Literal["single", "multi"]
    required: bool


@dataclass(frozen=True)
class OptionSelectionError:
    reason: Literal["option_not_available", "required_group_missing", "single_group_conflict"]
    group_name: str | None = None
    option_id: int | None = None


def validate_option_selection(
    available: Sequence[SelectableOption], selected_ids: Sequence[int]
) -> OptionSelectionError | None:
    by_id = {o.option_id: o for o in available}

    for oid in selected_ids:
        if oid not in by_id:
            return OptionSelectionError(reason="option_not_available", option_id=oid)

    picks_per_group: dict[int, int] = {}
    for oid in selected_ids:
        gid = by_id[oid].group_id
        picks_per_group[gid] = picks_per_group.get(gid, 0) + 1

    groups: dict[int, SelectableOption] = {}
    for o in available:
        groups.setdefault(o.group_id, o)

    for gid, sample in groups.items():
        picked = picks_per_group.get(gid, 0)
        if sample.select_type == "single" and picked > 1:
            return OptionSelectionError(
                reason="single_group_conflict", group_name=sample.group_name
            )
        if sample.required and picked == 0:
            return OptionSelectionError(
                reason="required_group_missing", group_name=sample.group_name
            )

    return None
