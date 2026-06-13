from __future__ import annotations

import pytest

# Task 1 makes each Category own its option groups (a category's groups ARE its
# preset) and removes the global ``CategoryPresetGroup`` table plus the
# GET/PUT /api/admin/categories/{id}/preset routes. The old assertions in this
# module (preset-table round-trip, PUT/GET preset ordering, unknown-group 404,
# empty-clears) are obsolete. Task 3 adds the replacement per-category
# option-groups read API and rewrites this module against it.
pytestmark = pytest.mark.skip(reason="Task 3 replaces preset routes / CategoryPresetGroup")


def test_category_preset_routes_rewritten_in_task_3():
    """Placeholder: preset behavior is re-specified against the new per-category
    option-groups API in Task 3. See module docstring for what was removed."""
