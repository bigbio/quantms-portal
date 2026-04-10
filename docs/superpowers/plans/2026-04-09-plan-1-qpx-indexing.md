# Plan 1: qpx Indexing Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `quantms-portal` Python package with collection index building, registry generation, static web data generation, and AI-generated metadata commands. Uses `qpx` as a dependency — does NOT modify qpx.

**Architecture:** A new `quantms-portal` Python package with a `portal` CLI (Click). Index builders use `qpx.Dataset` and `qpx.DatasetCollection` for DuckDB queries, writing partitioned parquet output with ZSTD compression. The static web generator reads QPX parquet metadata and writes JSON files for the Vue app on GitHub Pages.

**Tech Stack:** Python, Click (CLI), qpx (dependency), DuckDB, pyarrow, anthropic SDK (for AI metadata), json

**Working directory:** `/Users/yperez/work/quantms-workspace/quantms-portal/`

**Test data:** `/Users/yperez/work/quantms-workspace/quantms.io/msnet_qpx/` (12 samples, 576 runs, PSM data)

---

## File Structure

```
quantms-portal/                            # This repo (NEW Python package)
├── pyproject.toml                         # CREATE: package config, qpx as dependency
├── src/
│   └── quantms_portal/                    # CREATE: Python package
│       ├── __init__.py
│       ├── indexes/                       # CREATE: index builders
│       │   ├── __init__.py
│       │   ├── base.py                    # BaseIndexBuilder ABC
│       │   ├── peptide.py                 # PeptideIndexBuilder
│       │   ├── protein.py                 # ProteinIndexBuilder
│       │   ├── metadata.py                # MetadataIndexBuilder
│       │   └── registry.py               # RegistryBuilder
│       ├── web/                           # CREATE: static web data generator
│       │   ├── __init__.py
│       │   └── generator.py              # StaticDataGenerator
│       └── cli/                           # CREATE: CLI entry point
│           ├── __init__.py
│           ├── main.py                    # Click group (portal CLI)
│           ├── index.py                   # index build commands
│           └── web.py                     # web build commands
tests/
├── conftest.py                            # CREATE: test fixtures (minimal QPX datasets)
├── unit/
│   ├── test_index_builders.py             # CREATE: unit tests for index builders
│   ├── test_registry_builder.py           # CREATE: unit tests for registry
│   └── test_static_generator.py           # CREATE: unit tests for static data generator
├── integration/
│   └── test_collection_indexes.py         # CREATE: integration tests with real data
```

**Key principle:** This package imports from `qpx` but never modifies it. `qpx` is a pip dependency.

---

### Task 0: Project Setup (pyproject.toml + package skeleton)

**Files:**
- Create: `pyproject.toml`
- Create: `src/quantms_portal/__init__.py`
- Create: `tests/conftest.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
# pyproject.toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "quantms-portal"
version = "0.1.0"
description = "Tooling for portal.quantms.org — index building, static web generation, and API"
requires-python = ">=3.10"
dependencies = [
    "qpx",
    "click>=8.1",
    "pyarrow>=14.0",
    "duckdb>=1.1.3",
]

[project.optional-dependencies]
ai = ["anthropic>=0.40"]
dev = ["pytest>=7.0", "ruff"]

[project.scripts]
quantms-portal = "quantms_portal.cli.main:main"

[tool.hatch.build.targets.wheel]
packages = ["src/quantms_portal"]

[tool.pytest.ini_options]
testpaths = ["tests"]
markers = [
    "integration: marks tests requiring real QPX datasets",
]
```

- [ ] **Step 2: Create package __init__.py**

```python
# src/quantms_portal/__init__.py
"""quantms-portal: Tooling for portal.quantms.org."""
__version__ = "0.1.0"
```

- [ ] **Step 3: Create test conftest with QPX dataset fixtures**

```python
# tests/conftest.py
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from pathlib import Path


@pytest.fixture
def minimal_dataset(tmp_path):
    """Create a minimal QPX dataset directory with dataset + sample + run parquets."""
    ds_dir = tmp_path / "PXD000001"
    ds_dir.mkdir()

    pq.write_table(pa.table({
        "project_accession": ["PXD000001"],
        "project_title": ["Test Dataset"],
        "project_description": ["A test dataset for unit tests"],
    }), ds_dir / "PXD000001.dataset.parquet")

    pq.write_table(pa.table({
        "sample_id": ["S1", "S2", "S3"],
        "project_accession": ["PXD000001"] * 3,
        "organism": ["Homo sapiens"] * 3,
        "characteristics_tissue": ["Liver", "Brain", "Heart"],
    }), ds_dir / "PXD000001.sample.parquet")

    pq.write_table(pa.table({
        "run_id": ["R1", "R2"],
        "sample_id": ["S1", "S2"],
        "instrument": ["Orbitrap", "Orbitrap"],
    }), ds_dir / "PXD000001.run.parquet")

    return ds_dir


@pytest.fixture
def minimal_collection(tmp_path, minimal_dataset):
    """Create a minimal collection directory with one dataset."""
    coll_dir = tmp_path / "test-collection"
    coll_dir.mkdir()
    # Move dataset into collection
    import shutil
    shutil.copytree(minimal_dataset, coll_dir / minimal_dataset.name)
    return coll_dir
```

- [ ] **Step 4: Install package in dev mode**

```bash
cd /Users/yperez/work/quantms-workspace/quantms-portal
pip install -e ".[dev]"
python -c "import quantms_portal; print(quantms_portal.__version__)"
```

Expected: `0.1.0`

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml src/quantms_portal/__init__.py tests/conftest.py
git commit -m "feat: initialize quantms-portal Python package with qpx dependency"
```

---

### Task 1: BaseIndexBuilder ABC

**Files:**
- Create: `qpx/indexes/__init__.py`
- Create: `qpx/indexes/base.py`
- Test: `tests/unit/test_index_builders.py`

- [ ] **Step 1: Create the indexes package**

```python
# qpx/indexes/__init__.py
from quantms_portal.indexes.base import BaseIndexBuilder

__all__ = ["BaseIndexBuilder"]
```

- [ ] **Step 2: Write the failing test for BaseIndexBuilder**

```python
# tests/unit/test_index_builders.py
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from pathlib import Path


def test_base_index_builder_writes_partitioned_parquet(tmp_path):
    """BaseIndexBuilder subclass writes partitioned parquet with metadata."""
    from quantms_portal.indexes.base import BaseIndexBuilder

    class DummyIndex(BaseIndexBuilder):
        index_type = "dummy"
        partition_column = "prefix"

        def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
            return "SELECT 'ACDEF' AS sequence, 'AC' AS prefix, 1 AS count"

    builder = DummyIndex()
    # build() takes a collection path (directory with datasets)
    result = builder.build(tmp_path / "collection", output_dir=tmp_path / "output")

    assert (tmp_path / "output" / "dummy").is_dir()
    metadata_path = tmp_path / "output" / "dummy" / "_metadata.parquet"
    assert metadata_path.exists()


def test_base_index_builder_metadata_parquet_has_required_fields(tmp_path):
    """_metadata.parquet contains index_type, built_at, datasets_included, total_entries."""
    from quantms_portal.indexes.base import BaseIndexBuilder

    class DummyIndex(BaseIndexBuilder):
        index_type = "dummy"
        partition_column = "prefix"

        def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
            return "SELECT 'ACDEF' AS sequence, 'AC' AS prefix, 1 AS count"

    builder = DummyIndex()
    builder.build(tmp_path / "collection", output_dir=tmp_path / "output")

    meta_df = pq.read_table(tmp_path / "output" / "dummy" / "_metadata.parquet").to_pandas()
    assert "index_type" in meta_df.columns
    assert "built_at" in meta_df.columns
    assert "total_entries" in meta_df.columns
    assert meta_df["index_type"].iloc[0] == "dummy"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_index_builders.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'qpx.indexes'`

- [ ] **Step 4: Implement BaseIndexBuilder**

```python
# qpx/indexes/base.py
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq


class BaseIndexBuilder(ABC):
    """Base class for collection index builders.

    Subclasses define index_type, partition_column, and build_sql().
    The build() method runs the SQL against a DatasetCollection's DuckDB engine,
    writes partitioned parquet output, and generates _metadata.parquet.
    """

    index_type: str = ""
    partition_column: str = ""

    @abstractmethod
    def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
        """Return the DuckDB SQL that produces the index rows.

        Args:
            dataset_table_map: mapping of dataset index → list of registered table names.
                E.g., {0: ["psm_0", "sample_0"], 1: ["psm_1", "sample_1"]}
        """
        ...

    def build(
        self,
        collection_path: str | Path,
        output_dir: str | Path | None = None,
        compression: str = "zstd",
    ) -> Path:
        """Build the index from a collection directory.

        Args:
            collection_path: path to the collection root (contains dataset subdirs).
            output_dir: where to write the index. Defaults to collection_path/_index/.
            compression: parquet compression codec.

        Returns:
            Path to the index directory.
        """
        from qpx.dataset import Dataset
        from qpx.collection import DatasetCollection

        collection_path = Path(collection_path)
        if output_dir is None:
            output_dir = collection_path / "_index"
        output_dir = Path(output_dir)
        index_dir = output_dir / self.index_type
        index_dir.mkdir(parents=True, exist_ok=True)

        # Discover datasets
        datasets = []
        dataset_accessions = []
        for sub in sorted(collection_path.iterdir()):
            if sub.is_dir() and not sub.name.startswith("_"):
                dataset_files = list(sub.glob("*.dataset.parquet"))
                if dataset_files:
                    datasets.append(Dataset(sub))
                    dataset_accessions.append(sub.name)

        if not datasets:
            raise ValueError(f"No datasets found in {collection_path}")

        # Use DatasetCollection to register all datasets in DuckDB
        coll = DatasetCollection(datasets)
        try:
            dataset_table_map = coll.structure_names
            sql = self.build_sql(dataset_table_map)
            result = coll.sql(sql)
            table = result.to_arrow()
            total_entries = table.num_rows

            if total_entries == 0:
                raise ValueError(f"Index build produced 0 rows for {self.index_type}")

            # Write partitioned parquet
            if self.partition_column and self.partition_column in table.column_names:
                pq.write_to_dataset(
                    table,
                    root_path=str(index_dir),
                    partition_cols=[self.partition_column],
                    compression=compression,
                )
            else:
                pq.write_table(table, index_dir / "data.parquet", compression=compression)

            # Write _metadata.parquet
            meta_table = pa.table({
                "index_type": [self.index_type],
                "built_at": [datetime.now(timezone.utc).isoformat()],
                "datasets_included": [dataset_accessions],
                "total_entries": [total_entries],
                "partition_column": [self.partition_column or ""],
                "compression": [compression],
            })
            pq.write_table(meta_table, index_dir / "_metadata.parquet")
        finally:
            coll.close()

        return index_dir
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_index_builders.py -v`
Expected: Tests may need adjustment based on actual DatasetCollection behavior with empty/dummy data. Fix as needed.

- [ ] **Step 6: Commit**

```bash
cd /Users/yperez/work/quantms-workspace/quantms-portal
git add src/quantms_portal/indexes/ tests/unit/test_index_builders.py
git commit -m "feat: add BaseIndexBuilder ABC for collection index building"
```

---

### Task 2: PeptideIndexBuilder

**Files:**
- Create: `qpx/indexes/peptide.py`
- Modify: `qpx/indexes/__init__.py`
- Test: `tests/unit/test_index_builders.py`

- [ ] **Step 1: Write failing test**

```python
# tests/unit/test_index_builders.py (append)

def test_peptide_index_builder_sql_references_psm_tables(tmp_path):
    """PeptideIndexBuilder.build_sql generates SQL that queries PSM tables."""
    from quantms_portal.indexes.peptide import PeptideIndexBuilder

    builder = PeptideIndexBuilder()
    assert builder.index_type == "peptide"
    assert builder.partition_column == "sequence_prefix"

    # Simulate dataset_table_map from DatasetCollection
    table_map = {0: ["psm_0", "sample_0", "dataset_0"], 1: ["psm_1", "dataset_1"]}
    sql = builder.build_sql(table_map)

    assert "psm_0" in sql
    assert "psm_1" in sql
    assert "sequence_prefix" in sql
    assert "spectra_count" in sql
    assert "is_decoy" in sql.lower() or "decoy" in sql.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_index_builders.py::test_peptide_index_builder_sql_references_psm_tables -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement PeptideIndexBuilder**

```python
# qpx/indexes/peptide.py
from quantms_portal.indexes.base import BaseIndexBuilder


class PeptideIndexBuilder(BaseIndexBuilder):
    """Builds a peptide index from PSM data across all datasets in a collection.

    Partitioned by first 2 amino acids of the sequence (~400 partitions).
    Aggregates per (sequence, peptidoform, project_accession).
    """

    index_type = "peptide"
    partition_column = "sequence_prefix"

    def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
        # Build UNION ALL across all datasets' PSM tables
        psm_tables = []
        for idx, tables in dataset_table_map.items():
            psm_names = [t for t in tables if t.startswith("psm")]
            if psm_names:
                psm_tables.append(psm_names[0])

        if not psm_tables:
            raise ValueError("No PSM tables found in collection datasets")

        union_parts = []
        for table_name in psm_tables:
            union_parts.append(
                f"SELECT sequence, peptidoform, charge, "
                f"posterior_error_probability, protein_accessions, "
                f"is_decoy, project_accession "
                f"FROM {table_name}"
            )
        union_sql = " UNION ALL ".join(union_parts)

        return f"""
        SELECT
            sequence,
            peptidoform,
            project_accession,
            LIST(DISTINCT charge ORDER BY charge) AS charge_states,
            COUNT(*) AS spectra_count,
            MIN(posterior_error_probability) AS best_pep,
            LIST(DISTINCT protein_accessions) AS protein_accessions,
            LEFT(sequence, 2) AS sequence_prefix
        FROM ({union_sql}) AS all_psms
        WHERE is_decoy = false
        GROUP BY sequence, peptidoform, project_accession
        ORDER BY sequence_prefix, sequence
        """
```

- [ ] **Step 4: Update __init__.py**

```python
# qpx/indexes/__init__.py
from quantms_portal.indexes.base import BaseIndexBuilder
from quantms_portal.indexes.peptide import PeptideIndexBuilder

__all__ = ["BaseIndexBuilder", "PeptideIndexBuilder"]
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_index_builders.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/yperez/work/quantms-workspace/quantms-portal
git add src/quantms_portal/indexes/peptide.py src/quantms_portal/indexes/__init__.py tests/unit/test_index_builders.py
git commit -m "feat: add PeptideIndexBuilder for collection peptide indexes"
```

---

### Task 3: ProteinIndexBuilder

**Files:**
- Create: `qpx/indexes/protein.py`
- Modify: `qpx/indexes/__init__.py`
- Test: `tests/unit/test_index_builders.py`

- [ ] **Step 1: Write failing test**

```python
# tests/unit/test_index_builders.py (append)

def test_protein_index_builder_sql_references_pg_tables():
    """ProteinIndexBuilder.build_sql generates SQL that queries PG tables."""
    from quantms_portal.indexes.protein import ProteinIndexBuilder

    builder = ProteinIndexBuilder()
    assert builder.index_type == "protein"
    assert builder.partition_column == "accession_prefix"

    table_map = {0: ["pg_0", "sample_0", "dataset_0"], 1: ["pg_1", "dataset_1"]}
    sql = builder.build_sql(table_map)

    assert "pg_0" in sql
    assert "pg_1" in sql
    assert "anchor_protein" in sql
    assert "accession_prefix" in sql
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_index_builders.py::test_protein_index_builder_sql_references_pg_tables -v`
Expected: FAIL

- [ ] **Step 3: Implement ProteinIndexBuilder**

```python
# qpx/indexes/protein.py
from quantms_portal.indexes.base import BaseIndexBuilder


class ProteinIndexBuilder(BaseIndexBuilder):
    """Builds a protein index from PG data across all datasets in a collection.

    Partitioned by first 2 characters of anchor_protein (~300-400 partitions).
    Aggregates per (anchor_protein, project_accession).
    """

    index_type = "protein"
    partition_column = "accession_prefix"

    def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
        pg_tables = []
        for idx, tables in dataset_table_map.items():
            pg_names = [t for t in tables if t.startswith("pg")]
            if pg_names:
                pg_tables.append(pg_names[0])

        if not pg_tables:
            raise ValueError("No PG tables found in collection datasets")

        union_parts = []
        for table_name in pg_tables:
            union_parts.append(
                f"SELECT anchor_protein, protein_accessions, project_accession, "
                f"gg_names, global_qvalue, num_peptides, run_file_name "
                f"FROM {table_name}"
            )
        union_sql = " UNION ALL ".join(union_parts)

        return f"""
        SELECT
            anchor_protein,
            LIST(DISTINCT protein_accessions) AS protein_accessions,
            project_accession,
            LIST(DISTINCT gg_names) AS gg_names,
            MIN(global_qvalue) AS global_qvalue,
            SUM(num_peptides) AS num_peptides,
            COUNT(DISTINCT run_file_name) AS num_runs,
            LEFT(anchor_protein, 2) AS accession_prefix
        FROM ({union_sql}) AS all_pgs
        GROUP BY anchor_protein, project_accession
        ORDER BY accession_prefix, anchor_protein
        """
```

- [ ] **Step 4: Update __init__.py**

```python
# qpx/indexes/__init__.py
from quantms_portal.indexes.base import BaseIndexBuilder
from quantms_portal.indexes.peptide import PeptideIndexBuilder
from quantms_portal.indexes.protein import ProteinIndexBuilder

__all__ = ["BaseIndexBuilder", "PeptideIndexBuilder", "ProteinIndexBuilder"]
```

- [ ] **Step 5: Run tests and commit**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_index_builders.py -v`

```bash
git add src/quantms_portal/indexes/protein.py src/quantms_portal/indexes/__init__.py tests/unit/test_index_builders.py
git commit -m "feat: add ProteinIndexBuilder for collection protein indexes"
```

---

### Task 4: MetadataIndexBuilder

**Files:**
- Create: `qpx/indexes/metadata.py`
- Modify: `qpx/indexes/__init__.py`
- Test: `tests/unit/test_index_builders.py`

- [ ] **Step 1: Write failing test**

```python
# tests/unit/test_index_builders.py (append)

def test_metadata_index_builder_sql_references_dataset_and_sample_tables():
    """MetadataIndexBuilder aggregates dataset + sample + run metadata."""
    from quantms_portal.indexes.metadata import MetadataIndexBuilder

    builder = MetadataIndexBuilder()
    assert builder.index_type == "metadata"
    assert builder.partition_column == ""  # not partitioned

    table_map = {
        0: ["dataset_0", "sample_0", "run_0", "psm_0"],
        1: ["dataset_1", "sample_1", "run_1"],
    }
    sql = builder.build_sql(table_map)

    assert "dataset_0" in sql
    assert "sample_0" in sql
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_index_builders.py::test_metadata_index_builder_sql_references_dataset_and_sample_tables -v`

- [ ] **Step 3: Implement MetadataIndexBuilder**

```python
# qpx/indexes/metadata.py
from quantms_portal.indexes.base import BaseIndexBuilder


class MetadataIndexBuilder(BaseIndexBuilder):
    """Builds an aggregated metadata index across all datasets in a collection.

    Not partitioned — produces a single parquet file with one row per dataset.
    Aggregates organism, tissue, instrument, sample count, run count from
    dataset, sample, and run structures.
    """

    index_type = "metadata"
    partition_column = ""  # not partitioned

    def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
        parts = []
        for idx, tables in dataset_table_map.items():
            dataset_t = next((t for t in tables if t.startswith("dataset")), None)
            sample_t = next((t for t in tables if t.startswith("sample")), None)
            run_t = next((t for t in tables if t.startswith("run")), None)

            if not dataset_t:
                continue

            # Build per-dataset metadata query
            sample_agg = ""
            if sample_t:
                sample_agg = f"""
                    (SELECT COUNT(*) FROM {sample_t}) AS n_samples,
                    (SELECT LIST(DISTINCT organism) FROM {sample_t}) AS organisms,
                    (SELECT LIST(DISTINCT characteristics_tissue) FROM {sample_t}
                     WHERE characteristics_tissue IS NOT NULL) AS tissues,
                """
            else:
                sample_agg = "0 AS n_samples, [] AS organisms, [] AS tissues,"

            run_agg = ""
            if run_t:
                run_agg = f"""
                    (SELECT COUNT(*) FROM {run_t}) AS n_runs,
                    (SELECT LIST(DISTINCT instrument) FROM {run_t}
                     WHERE instrument IS NOT NULL) AS instruments
                """
            else:
                run_agg = "0 AS n_runs, [] AS instruments"

            parts.append(f"""
                SELECT
                    d.project_accession,
                    d.project_title,
                    {sample_agg}
                    {run_agg}
                FROM {dataset_t} d
            """)

        if not parts:
            raise ValueError("No dataset tables found in collection")

        return " UNION ALL ".join(parts)
```

- [ ] **Step 4: Update __init__.py, run tests, commit**

```python
# qpx/indexes/__init__.py
from quantms_portal.indexes.base import BaseIndexBuilder
from quantms_portal.indexes.peptide import PeptideIndexBuilder
from quantms_portal.indexes.protein import ProteinIndexBuilder
from quantms_portal.indexes.metadata import MetadataIndexBuilder

__all__ = [
    "BaseIndexBuilder",
    "PeptideIndexBuilder",
    "ProteinIndexBuilder",
    "MetadataIndexBuilder",
]
```

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_index_builders.py -v`

```bash
git add src/quantms_portal/indexes/metadata.py src/quantms_portal/indexes/__init__.py tests/unit/test_index_builders.py
git commit -m "feat: add MetadataIndexBuilder for collection metadata aggregation"
```

---

### Task 5: RegistryBuilder

**Files:**
- Create: `qpx/indexes/registry.py`
- Test: `tests/unit/test_registry_builder.py`

- [ ] **Step 1: Write failing test**

```python
# tests/unit/test_registry_builder.py
import pyarrow.parquet as pq
from pathlib import Path


def test_registry_builder_produces_parquet_with_collection_stats(tmp_path):
    """RegistryBuilder scans collections root and produces registry.parquet."""
    from quantms_portal.indexes.registry import RegistryBuilder

    builder = RegistryBuilder()
    # build takes the root that contains collection directories
    result = builder.build(tmp_path / "collections", output_path=tmp_path / "registry.parquet")

    assert (tmp_path / "registry.parquet").exists()


def test_registry_parquet_has_required_columns(tmp_path):
    """registry.parquet has name, title, type, dataset_count, organisms columns."""
    from quantms_portal.indexes.registry import RegistryBuilder

    builder = RegistryBuilder()
    builder.build(tmp_path / "collections", output_path=tmp_path / "registry.parquet")

    table = pq.read_table(tmp_path / "registry.parquet")
    required = {"name", "dataset_count"}
    assert required.issubset(set(table.column_names))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_registry_builder.py -v`

- [ ] **Step 3: Implement RegistryBuilder**

```python
# qpx/indexes/registry.py
from datetime import datetime, timezone
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq


class RegistryBuilder:
    """Builds registry.parquet from a collections root directory.

    Scans each collection subdirectory, reads _index/metadata/metadata.parquet
    if available, otherwise counts datasets directly. Produces a single
    registry.parquet with one row per collection.
    """

    def build(
        self,
        collections_root: str | Path,
        output_path: str | Path | None = None,
    ) -> Path:
        collections_root = Path(collections_root)
        if output_path is None:
            output_path = collections_root.parent / "registry.parquet"
        output_path = Path(output_path)

        rows = []
        if collections_root.exists():
            for coll_dir in sorted(collections_root.iterdir()):
                if not coll_dir.is_dir() or coll_dir.name.startswith("."):
                    continue
                row = self._scan_collection(coll_dir)
                if row:
                    rows.append(row)

        if not rows:
            # Write empty registry with schema
            rows = [{
                "name": "",
                "title": "",
                "description": "",
                "type": "",
                "dataset_count": 0,
                "organisms": [],
                "updated": datetime.now(timezone.utc).isoformat(),
            }]
            table = pa.table({k: [v] for k, v in rows[0].items()})
            # Write empty then overwrite to get schema right
            table = table.slice(0, 0)
        else:
            table = pa.table({
                "name": [r["name"] for r in rows],
                "title": [r.get("title", "") for r in rows],
                "description": [r.get("description", "") for r in rows],
                "type": [r.get("type", "") for r in rows],
                "dataset_count": [r["dataset_count"] for r in rows],
                "organisms": [r.get("organisms", []) for r in rows],
                "updated": [datetime.now(timezone.utc).isoformat()] * len(rows),
            })

        output_path.parent.mkdir(parents=True, exist_ok=True)
        pq.write_table(table, str(output_path), compression="zstd")
        return output_path

    def _scan_collection(self, coll_dir: Path) -> dict | None:
        """Scan a single collection directory for metadata."""
        # Count datasets (subdirs with *.dataset.parquet, excluding _prefixed)
        dataset_count = 0
        for sub in coll_dir.iterdir():
            if sub.is_dir() and not sub.name.startswith("_"):
                if list(sub.glob("*.dataset.parquet")):
                    dataset_count += 1

        if dataset_count == 0:
            return None

        row = {
            "name": coll_dir.name,
            "dataset_count": dataset_count,
        }

        # Try to read metadata index for richer info
        meta_path = coll_dir / "_index" / "metadata" / "metadata.parquet"
        if meta_path.exists():
            try:
                meta_df = pq.read_table(meta_path).to_pandas()
                if "organisms" in meta_df.columns:
                    all_orgs = []
                    for org_list in meta_df["organisms"].dropna():
                        if isinstance(org_list, list):
                            all_orgs.extend(org_list)
                    row["organisms"] = list(set(all_orgs))
                if "project_title" in meta_df.columns:
                    row["title"] = f"{coll_dir.name} ({dataset_count} datasets)"
            except Exception:
                pass

        return row
```

- [ ] **Step 4: Update __init__.py, run tests, commit**

```python
# qpx/indexes/__init__.py
from quantms_portal.indexes.base import BaseIndexBuilder
from quantms_portal.indexes.peptide import PeptideIndexBuilder
from quantms_portal.indexes.protein import ProteinIndexBuilder
from quantms_portal.indexes.metadata import MetadataIndexBuilder
from quantms_portal.indexes.registry import RegistryBuilder

__all__ = [
    "BaseIndexBuilder",
    "PeptideIndexBuilder",
    "ProteinIndexBuilder",
    "MetadataIndexBuilder",
    "RegistryBuilder",
]
```

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_registry_builder.py -v`

```bash
git add src/quantms_portal/indexes/registry.py src/quantms_portal/indexes/__init__.py tests/unit/test_registry_builder.py
git commit -m "feat: add RegistryBuilder for portal registry.parquet generation"
```

---

### Task 6: CLI Commands — `qpxc collection`

**Files:**
- Create: `qpx/cli/collection.py`
- Modify: `qpx/cli/main.py`

- [ ] **Step 1: Write the CLI command module**

```python
# qpx/cli/collection.py
import click
from pathlib import Path


@click.group()
def collection():
    """Collection index and registry commands."""
    pass


@collection.command("build-index")
@click.argument("collection_path", type=click.Path(exists=True))
@click.option(
    "--index-type",
    type=click.Choice(["peptide", "protein", "metadata", "all"]),
    required=True,
    help="Type of index to build.",
)
@click.option(
    "--output-dir",
    type=click.Path(),
    default=None,
    help="Output directory. Defaults to COLLECTION_PATH/_index/.",
)
def build_index(collection_path, index_type, output_dir):
    """Build a collection index.

    Examples:

        qpxc collection build-index ./msnet_qpx --index-type peptide

        qpxc collection build-index ./msnet_qpx --index-type all
    """
    from quantms_portal.indexes import PeptideIndexBuilder, ProteinIndexBuilder, MetadataIndexBuilder

    builders = {
        "peptide": PeptideIndexBuilder,
        "protein": ProteinIndexBuilder,
        "metadata": MetadataIndexBuilder,
    }

    if index_type == "all":
        types_to_build = list(builders.keys())
    else:
        types_to_build = [index_type]

    for idx_type in types_to_build:
        click.echo(f"Building {idx_type} index for {collection_path}...")
        builder = builders[idx_type]()
        try:
            result_path = builder.build(collection_path, output_dir=output_dir)
            click.echo(f"  -> {result_path}")
        except ValueError as e:
            click.echo(f"  -> Skipped: {e}", err=True)

    click.echo("Done.")


@collection.command("build-registry")
@click.argument("collections_root", type=click.Path(exists=True))
@click.option(
    "--output",
    type=click.Path(),
    default=None,
    help="Output path. Defaults to COLLECTIONS_ROOT/../registry.parquet.",
)
def build_registry(collections_root, output):
    """Build registry.parquet from a collections root directory.

    Example:

        qpxc collection build-registry ./collections/ --output ./registry.parquet
    """
    from quantms_portal.indexes.registry import RegistryBuilder

    click.echo(f"Building registry from {collections_root}...")
    builder = RegistryBuilder()
    result_path = builder.build(collections_root, output_path=output)
    click.echo(f"Registry written to {result_path}")


@collection.command("describe")
@click.argument("collection_path", type=click.Path(exists=True))
@click.option("--ai", is_flag=True, help="Use AI (Claude) to generate description.")
@click.option("--output", type=click.Path(), default=None, help="Write description to file.")
def describe(collection_path, ai, output):
    """Generate a collection description.

    Without --ai: prints basic stats from metadata.
    With --ai: calls Claude API to generate title, description, and tags.

    Examples:

        qpxc collection describe ./msnet_qpx

        qpxc collection describe ./msnet_qpx --ai
    """
    collection_path = Path(collection_path)

    # Gather basic stats
    from quantms_portal.indexes.registry import RegistryBuilder
    builder = RegistryBuilder()
    stats = builder._scan_collection(collection_path)

    if not stats:
        click.echo("No datasets found in collection.", err=True)
        return

    click.echo(f"Collection: {stats['name']}")
    click.echo(f"Datasets: {stats['dataset_count']}")
    if stats.get("organisms"):
        click.echo(f"Organisms: {', '.join(stats['organisms'])}")

    if not ai:
        return

    # AI-generated description
    try:
        import anthropic
    except ImportError:
        click.echo("Install anthropic SDK: pip install anthropic", err=True)
        return

    # Read metadata index if available
    meta_path = collection_path / "_index" / "metadata" / "metadata.parquet"
    context = f"Collection name: {stats['name']}\nDatasets: {stats['dataset_count']}\n"
    if meta_path.exists():
        import pyarrow.parquet as pq
        meta_df = pq.read_table(meta_path).to_pandas()
        context += f"Metadata:\n{meta_df.to_string()}\n"

    # Read PRIDE metadata for each dataset
    from qpx.core.pride import fetch_pride_metadata
    for sub in sorted(collection_path.iterdir()):
        if sub.is_dir() and not sub.name.startswith("_"):
            if list(sub.glob("*.dataset.parquet")):
                try:
                    pride_meta = fetch_pride_metadata(sub.name)
                    if pride_meta:
                        context += f"\n{sub.name}: {pride_meta.get('title', 'N/A')}"
                except Exception:
                    pass

    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                f"Generate a concise title, description (2-3 sentences), and tags "
                f"for this proteomics data collection.\n\n{context}\n\n"
                f"Format:\nTitle: ...\nDescription: ...\nTags: tag1, tag2, tag3"
            ),
        }],
    )

    result = message.content[0].text
    click.echo(f"\n--- AI-Generated Description ---\n{result}")

    if output:
        Path(output).write_text(result)
        click.echo(f"\nSaved to {output}")
```

- [ ] **Step 2: Register in main.py**

Find the section in `qpx/cli/main.py` where commands are registered and add:

```python
from qpx.cli.collection import collection
qpx_main.add_command(collection)
```

- [ ] **Step 3: Test CLI manually**

```bash
cd /Users/yperez/work/quantms-workspace/quantms.io
quantms-portal --help
quantms-portal index --help
quantms-portal index build --help
```

Expected: Help text displayed for all commands.

- [ ] **Step 4: Commit**

```bash
git add src/quantms_portal/cli/
git commit -m "feat: add portal CLI commands (index build, web build)"
```

---

### Task 7: Integration Test with msnet_qpx

**Files:**
- Create: `tests/integration/test_collection_indexes.py`

- [ ] **Step 1: Write integration test**

```python
# tests/integration/test_collection_indexes.py
"""Integration tests for collection index building using real msnet_qpx data."""
import pytest
import pyarrow.parquet as pq
from pathlib import Path

MSNET_PATH = Path(__file__).parent.parent.parent / "msnet_qpx"

pytestmark = pytest.mark.skipif(
    not MSNET_PATH.exists(),
    reason="msnet_qpx test data not available",
)


class TestMetadataIndex:
    def test_metadata_index_builds_from_msnet(self, tmp_path):
        from quantms_portal.indexes.metadata import MetadataIndexBuilder

        builder = MetadataIndexBuilder()
        result = builder.build(MSNET_PATH, output_dir=tmp_path)

        assert (tmp_path / "metadata" / "data.parquet").exists() or (
            tmp_path / "metadata" / "_metadata.parquet"
        ).exists()

    def test_metadata_index_has_project_accession(self, tmp_path):
        from quantms_portal.indexes.metadata import MetadataIndexBuilder

        builder = MetadataIndexBuilder()
        builder.build(MSNET_PATH, output_dir=tmp_path)

        # Find the data file
        data_files = list((tmp_path / "metadata").glob("*.parquet"))
        data_files = [f for f in data_files if f.name != "_metadata.parquet"]
        assert len(data_files) > 0

        table = pq.read_table(data_files[0])
        assert "project_accession" in table.column_names


class TestRegistryBuilder:
    def test_registry_from_parent_of_msnet(self, tmp_path):
        """Build registry treating msnet_qpx's parent as the collections root."""
        from quantms_portal.indexes.registry import RegistryBuilder

        # msnet_qpx is at quantms.io/msnet_qpx — its parent has collections
        builder = RegistryBuilder()
        result = builder.build(MSNET_PATH.parent, output_path=tmp_path / "registry.parquet")

        assert result.exists()
        table = pq.read_table(result)
        assert table.num_rows > 0
        names = table.column("name").to_pylist()
        assert "msnet_qpx" in names or any("msnet" in n for n in names)
```

- [ ] **Step 2: Run integration tests**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/integration/test_collection_indexes.py -v`

Expected: Tests pass against real msnet_qpx data. Fix any SQL column name mismatches (the real PSM parquet may have slightly different column names than assumed — check with `qpxc info schema msnet_qpx/PXD000865/PXD000865.psm.parquet`).

- [ ] **Step 3: Fix any column name mismatches**

If tests fail due to column names, read the actual parquet schemas:

```bash
python -c "import pyarrow.parquet as pq; print(pq.read_schema('msnet_qpx/PXD000865/psm/organism=Homo_sapiens/run=some_file/part-0.parquet'))"
```

Update the SQL in the index builders to match actual column names.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/test_collection_indexes.py
git commit -m "test: add integration tests for collection index building with msnet data"
```

---

---

---

### Task 9: StaticDataGenerator

**Files:**
- Create: `qpx/portal/__init__.py`
- Create: `qpx/portal/static_generator.py`
- Test: `tests/unit/test_static_generator.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/unit/test_static_generator.py
import json
import pyarrow as pa
import pyarrow.parquet as pq
from pathlib import Path


def _make_minimal_dataset(dataset_dir: Path, accession: str = "PXD000001"):
    """Helper: create a minimal QPX dataset with dataset + sample parquets."""
    dataset_dir.mkdir(parents=True, exist_ok=True)

    # dataset.parquet
    dataset_table = pa.table({
        "project_accession": [accession],
        "project_title": [f"Test Dataset {accession}"],
        "project_description": ["A test dataset"],
    })
    pq.write_table(dataset_table, dataset_dir / f"{accession}.dataset.parquet")

    # sample.parquet
    sample_table = pa.table({
        "sample_id": ["S1", "S2", "S3"],
        "project_accession": [accession] * 3,
        "organism": ["Homo sapiens", "Homo sapiens", "Homo sapiens"],
        "characteristics_tissue": ["Liver", "Brain", "Heart"],
    })
    pq.write_table(sample_table, dataset_dir / f"{accession}.sample.parquet")

    # run.parquet
    run_table = pa.table({
        "run_id": ["R1", "R2"],
        "sample_id": ["S1", "S2"],
        "instrument": ["Orbitrap", "Orbitrap"],
    })
    pq.write_table(run_table, dataset_dir / f"{accession}.run.parquet")


def test_static_generator_creates_registry_json(tmp_path):
    """StaticDataGenerator writes registry.json with collection listing."""
    from quantms_portal.web.generator import StaticDataGenerator

    # Create a collection with 2 datasets
    coll_dir = tmp_path / "collections" / "test-collection"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")
    _make_minimal_dataset(coll_dir / "PXD000002", "PXD000002")

    output = tmp_path / "output"
    gen = StaticDataGenerator()
    gen.build(tmp_path / "collections", output)

    registry = json.loads((output / "registry.json").read_text())
    assert "generated_at" in registry
    assert len(registry["collections"]) == 1
    assert registry["collections"][0]["name"] == "test-collection"
    assert registry["collections"][0]["dataset_count"] == 2


def test_static_generator_creates_collection_json(tmp_path):
    """Creates per-collection JSON with dataset listing."""
    from quantms_portal.web.generator import StaticDataGenerator

    coll_dir = tmp_path / "collections" / "mytest"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")

    output = tmp_path / "output"
    gen = StaticDataGenerator()
    gen.build(tmp_path / "collections", output)

    coll_json = json.loads(
        (output / "collections" / "mytest" / "collection.json").read_text()
    )
    assert coll_json["name"] == "mytest"
    assert len(coll_json["datasets"]) == 1
    assert coll_json["datasets"][0]["accession"] == "PXD000001"
    assert coll_json["datasets"][0]["samples"] == 3


def test_static_generator_creates_dataset_json_with_sample_preview(tmp_path):
    """Creates per-dataset JSON with capped sample preview."""
    from quantms_portal.web.generator import StaticDataGenerator

    coll_dir = tmp_path / "collections" / "mytest"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")

    output = tmp_path / "output"
    gen = StaticDataGenerator()
    gen.build(tmp_path / "collections", output)

    ds_json = json.loads(
        (output / "collections" / "mytest" / "datasets" / "PXD000001.json").read_text()
    )
    assert ds_json["accession"] == "PXD000001"
    assert ds_json["collection"] == "mytest"
    assert "samples_preview" in ds_json
    assert len(ds_json["samples_preview"]) <= 20
    assert ds_json["samples_preview"][0]["organism"] == "Homo sapiens"
    assert ds_json["samples_total"] == 3
    assert "generated_at" in ds_json
    assert "download" in ds_json


def test_static_generator_creates_global_stats(tmp_path):
    """Creates global-stats.json with aggregated statistics."""
    from quantms_portal.web.generator import StaticDataGenerator

    coll_dir = tmp_path / "collections" / "mytest"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")

    output = tmp_path / "output"
    gen = StaticDataGenerator()
    gen.build(tmp_path / "collections", output)

    stats = json.loads((output / "global-stats.json").read_text())
    assert "datasets_by_organism" in stats
    assert "Homo sapiens" in stats["datasets_by_organism"]


def test_static_generator_creates_paginated_dataset_listing(tmp_path):
    """Datasets are split into pages of N per file."""
    from quantms_portal.web.generator import StaticDataGenerator

    coll_dir = tmp_path / "collections" / "mytest"
    # Create 3 datasets with page size of 2 → 2 pages
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")
    _make_minimal_dataset(coll_dir / "PXD000002", "PXD000002")
    _make_minimal_dataset(coll_dir / "PXD000003", "PXD000003")

    output = tmp_path / "output"
    gen = StaticDataGenerator(datasets_per_page=2)
    gen.build(tmp_path / "collections", output)

    # collection.json has no datasets array, just page count
    coll = json.loads(
        (output / "collections" / "mytest" / "collection.json").read_text()
    )
    assert "datasets" not in coll
    assert coll["total_pages"] == 2
    assert coll["datasets_per_page"] == 2

    # Page 1 has 2 datasets
    page1 = json.loads(
        (output / "collections" / "mytest" / "datasets-page-1.json").read_text()
    )
    assert len(page1["datasets"]) == 2
    assert page1["page"] == 1
    assert page1["total_pages"] == 2

    # Page 2 has 1 dataset
    page2 = json.loads(
        (output / "collections" / "mytest" / "datasets-page-2.json").read_text()
    )
    assert len(page2["datasets"]) == 1
    assert page2["page"] == 2


def test_static_generator_incremental_skips_existing_datasets(tmp_path):
    """Incremental build does not rewrite existing dataset JSONs."""
    from quantms_portal.web.generator import StaticDataGenerator

    coll_dir = tmp_path / "collections" / "mytest"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")

    output = tmp_path / "output"
    gen = StaticDataGenerator()

    # First build
    gen.build(tmp_path / "collections", output, incremental=True)
    ds_path = output / "collections" / "mytest" / "datasets" / "PXD000001.json"
    first_mtime = ds_path.stat().st_mtime

    # Add a new dataset
    _make_minimal_dataset(coll_dir / "PXD000002", "PXD000002")

    import time
    time.sleep(0.1)  # ensure mtime difference

    # Second incremental build
    gen2 = StaticDataGenerator()
    gen2.build(tmp_path / "collections", output, incremental=True)

    # PXD000001.json should NOT have been rewritten
    assert ds_path.stat().st_mtime == first_mtime

    # PXD000002.json should exist (new)
    assert (output / "collections" / "mytest" / "datasets" / "PXD000002.json").exists()

    # Build state should track both
    build_state = json.loads((output / ".build-state.json").read_text())
    assert "PXD000001" in build_state
    assert "PXD000002" in build_state
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_static_generator.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'qpx.portal'`

- [ ] **Step 3: Implement StaticDataGenerator**

```python
# qpx/portal/__init__.py
from quantms_portal.web.generator import StaticDataGenerator

__all__ = ["StaticDataGenerator"]
```

```python
# qpx/portal/static_generator.py
"""Generate static JSON files for the portal.quantms.org Vue app.

Reads QPX parquet metadata from local directories (or S3 via DuckDB)
and writes lightweight JSON files for GitHub Pages. Only reads metadata
parquets (dataset, sample, run) — never touches PSM/feature/PG data.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

# Columns to include in sample preview (keep JSON small)
SAMPLE_PREVIEW_COLUMNS = [
    "sample_id", "organism", "characteristics_tissue",
    "characteristics_disease", "characteristics_cell_line",
]
SAMPLE_PREVIEW_MAX_ROWS = 20


DATASETS_PER_PAGE = 50


class StaticDataGenerator:
    """Generates static JSON data files for the portal Vue app.

    Supports incremental builds: only new/changed datasets get JSON files.
    Dataset JSONs are immutable once written. Paginated collection listings.
    """

    def __init__(
        self,
        s3_base_url: str = "s3://quantms-portal/collections",
        datasets_per_page: int = DATASETS_PER_PAGE,
    ):
        self.s3_base_url = s3_base_url
        self.datasets_per_page = datasets_per_page
        self._now = datetime.now(timezone.utc).isoformat()

    def build(
        self,
        collections_root: str | Path,
        output_dir: str | Path,
        incremental: bool = True,
    ) -> Path:
        """Build all static JSON files from a collections root directory.

        Args:
            collections_root: path containing collection subdirectories.
            output_dir: where to write JSON files.
            incremental: if True, skip datasets already in .build-state.json.

        Returns:
            Path to output directory.
        """
        collections_root = Path(collections_root)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Load build state for incremental mode
        state_path = output_dir / ".build-state.json"
        build_state: dict[str, str] = {}
        if incremental and state_path.exists():
            build_state = json.loads(state_path.read_text())

        all_collections = []
        all_organisms: dict[str, int] = {}
        all_workflows: dict[str, int] = {}

        for coll_dir in sorted(collections_root.iterdir()):
            if not coll_dir.is_dir() or coll_dir.name.startswith((".", "_")):
                continue

            coll_data = self._process_collection(coll_dir, output_dir, build_state)
            if coll_data:
                all_collections.append(coll_data["summary"])
                for org in coll_data.get("organisms", {}):
                    all_organisms[org] = all_organisms.get(org, 0) + coll_data["organisms"][org]

        # Write registry.json (always regenerated)
        registry = {
            "generated_at": self._now,
            "collections": all_collections,
            "global_stats": {
                "total_datasets": sum(c["dataset_count"] for c in all_collections),
                "total_collections": len(all_collections),
            },
        }
        self._write_json(output_dir / "registry.json", registry)

        # Write global-stats.json (always regenerated)
        global_stats = {
            "generated_at": self._now,
            "datasets_by_organism": all_organisms,
            "datasets_by_workflow": all_workflows,
        }
        self._write_json(output_dir / "global-stats.json", global_stats)

        # Save build state
        self._write_json(state_path, build_state)

        return output_dir

    def _process_collection(
        self, coll_dir: Path, output_dir: Path, build_state: dict[str, str]
    ) -> dict[str, Any] | None:
        """Process a single collection directory."""
        datasets = []
        organisms: dict[str, int] = {}

        for sub in sorted(coll_dir.iterdir()):
            if not sub.is_dir() or sub.name.startswith("_"):
                continue
            dataset_files = list(sub.glob("*.dataset.parquet"))
            if not dataset_files:
                continue

            accession = sub.name
            # Compute content hash for incremental builds
            content_hash = self._dataset_hash(sub)

            # Check if dataset JSON already exists and is current
            ds_output = output_dir / "collections" / coll_dir.name / "datasets"
            ds_json_path = ds_output / f"{accession}.json"

            if build_state.get(accession) == content_hash and ds_json_path.exists():
                # Dataset unchanged — load existing JSON for collection listing
                ds_data = json.loads(ds_json_path.read_text())
            else:
                # New or changed dataset — generate JSON
                ds_data = self._process_dataset(sub, coll_dir.name)
                if ds_data:
                    ds_output.mkdir(parents=True, exist_ok=True)
                    self._write_json(ds_json_path, ds_data)
                    build_state[accession] = content_hash

            if ds_data:
                datasets.append(ds_data)
                for org in ds_data.get("organisms", []):
                    organisms[org] = organisms.get(org, 0) + 1

        if not datasets:
            return None

        # Write collection.json (summary only, no dataset list — always regenerated)
        coll_output = output_dir / "collections" / coll_dir.name
        coll_output.mkdir(parents=True, exist_ok=True)

        import math
        total_pages = max(1, math.ceil(len(datasets) / self.datasets_per_page))

        coll_json = {
            "name": coll_dir.name,
            "title": coll_dir.name,
            "description": "",
            "generated_at": self._now,
            "dataset_count": len(datasets),
            "total_pages": total_pages,
            "datasets_per_page": self.datasets_per_page,
            "organisms": list(organisms.keys()),
            "stats": {},
            "indexes": self._detect_indexes(coll_dir),
        }
        self._write_json(coll_output / "collection.json", coll_json)

        # Write paginated dataset listings (always regenerated)
        dataset_entries = [
            {
                "accession": ds["accession"],
                "title": ds.get("title", ""),
                "organism": ds.get("organisms", [""])[0] if ds.get("organisms") else "",
                "samples": ds.get("samples_total", 0),
                "runs": ds.get("runs_total", 0),
                "structures": ds.get("structures", []),
                "qpx_pull": f"qpx pull {coll_dir.name}/{ds['accession']}",
            }
            for ds in datasets
        ]
        for page_num in range(1, total_pages + 1):
            start = (page_num - 1) * self.datasets_per_page
            end = start + self.datasets_per_page
            page_data = {
                "page": page_num,
                "total_pages": total_pages,
                "datasets": dataset_entries[start:end],
            }
            self._write_json(coll_output / f"datasets-page-{page_num}.json", page_data)

        return {
            "summary": {
                "name": coll_dir.name,
                "title": coll_json["title"],
                "description": coll_json["description"],
                "type": "",
                "dataset_count": len(datasets),
                "organisms": list(organisms.keys()),
                "indexes": coll_json["indexes"],
            },
            "organisms": organisms,
        }

    def _process_dataset(self, ds_dir: Path, collection_name: str) -> dict[str, Any] | None:
        """Process a single dataset directory. Reads only metadata parquets."""
        accession = ds_dir.name
        result: dict[str, Any] = {
            "accession": accession,
            "collection": collection_name,
            "generated_at": self._now,
            "structures": [],
            "download": {
                "s3_url": f"{self.s3_base_url}/{collection_name}/{accession}/",
                "qpx_command": f"qpx pull {collection_name}/{accession}",
            },
        }

        # Detect available structures
        for pf in ds_dir.glob("*.parquet"):
            # Extract structure name: PXD000865.sample.parquet → sample
            parts = pf.stem.split(".")
            if len(parts) >= 2:
                result["structures"].append(parts[-1])
        # Check for partitioned structures (e.g., psm/ directory)
        for sub in ds_dir.iterdir():
            if sub.is_dir() and not sub.name.startswith("_"):
                result["structures"].append(sub.name)

        # Read dataset.parquet
        dataset_files = list(ds_dir.glob("*.dataset.parquet"))
        if dataset_files:
            try:
                df = pq.read_table(dataset_files[0]).to_pandas()
                if len(df) > 0:
                    row = df.iloc[0]
                    result["title"] = str(row.get("project_title", ""))
                    result["description"] = str(row.get("project_description", ""))
            except Exception:
                pass

        # Read sample.parquet (preview only)
        sample_files = list(ds_dir.glob("*.sample.parquet"))
        if sample_files:
            try:
                sample_table = pq.read_table(sample_files[0])
                sample_df = sample_table.to_pandas()
                result["samples_total"] = len(sample_df)

                # Extract organisms
                if "organism" in sample_df.columns:
                    result["organisms"] = sorted(sample_df["organism"].dropna().unique().tolist())

                # Capped preview with key columns only
                preview_cols = [c for c in SAMPLE_PREVIEW_COLUMNS if c in sample_df.columns]
                preview_df = sample_df[preview_cols].head(SAMPLE_PREVIEW_MAX_ROWS)
                result["samples_preview"] = preview_df.to_dict(orient="records")
            except Exception:
                result["samples_total"] = 0
                result["samples_preview"] = []
        else:
            result["samples_total"] = 0
            result["samples_preview"] = []

        # Read run.parquet (count only)
        run_files = list(ds_dir.glob("*.run.parquet"))
        if run_files:
            try:
                run_table = pq.read_table(run_files[0])
                result["runs_total"] = run_table.num_rows
            except Exception:
                result["runs_total"] = 0
        else:
            result["runs_total"] = 0

        return result

    def _detect_indexes(self, coll_dir: Path) -> list[str]:
        """Detect which indexes exist in _index/ directory."""
        index_dir = coll_dir / "_index"
        if not index_dir.exists():
            return []
        return [
            d.name for d in index_dir.iterdir()
            if d.is_dir() and not d.name.startswith("_")
        ]

    @staticmethod
    def _dataset_hash(ds_dir: Path) -> str:
        """Compute a lightweight hash of dataset metadata for incremental builds.

        Uses dataset.parquet file modification time + accession. Does NOT read
        the full file — just filesystem metadata.
        """
        import hashlib
        dataset_files = list(ds_dir.glob("*.dataset.parquet"))
        if not dataset_files:
            return ""
        mtime = dataset_files[0].stat().st_mtime
        return hashlib.md5(f"{ds_dir.name}:{mtime}".encode()).hexdigest()

    @staticmethod
    def _write_json(path: Path, data: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, default=str, ensure_ascii=False))
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/unit/test_static_generator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/yperez/work/quantms-workspace/quantms.io
git add qpx/portal/__init__.py qpx/portal/static_generator.py tests/unit/test_static_generator.py
git commit -m "feat: add StaticDataGenerator for portal static JSON files"
```

---

### Task 10: Portal CLI Commands

**Files:**
- Create: `qpx/cli/portal.py`
- Modify: `qpx/cli/main.py`

- [ ] **Step 1: Write the portal CLI command module**

```python
# qpx/cli/portal.py
import click
from pathlib import Path


@click.group()
def portal():
    """Portal static data generation commands."""
    pass


@portal.command("build-web")
@click.argument("collections_root", type=click.Path(exists=True))
@click.option(
    "--output", "-o",
    type=click.Path(),
    required=True,
    help="Output directory for static JSON files (e.g., ./public/data/).",
)
@click.option(
    "--s3-base-url",
    default="s3://quantms-portal/collections",
    help="S3 base URL for download links in generated JSON.",
)
@click.option(
    "--incremental/--force",
    default=True,
    help="Incremental: skip unchanged datasets. Force: regenerate all.",
)
@click.option(
    "--datasets-per-page",
    default=50,
    help="Datasets per page in paginated collection listings.",
)
@click.option(
    "--pride-metadata",
    is_flag=True,
    help="Fetch titles/descriptions from PRIDE REST API.",
)
@click.option(
    "--ai",
    is_flag=True,
    help="Use AI (Claude) to generate collection descriptions.",
)
def build_data(collections_root, output, s3_base_url, incremental, datasets_per_page, pride_metadata, ai):
    """Generate static JSON data files for portal.quantms.org.

    Reads QPX parquet metadata from COLLECTIONS_ROOT and writes static JSON
    to OUTPUT. Only reads lightweight metadata parquets (dataset, sample, run)
    — never touches PSM/feature/PG data.

    Default is incremental mode: only new datasets get JSON files.
    Use --force to regenerate everything.

    Examples:

        qpxc portal build-web ./collections/ -o ./public/data/

        qpxc portal build-web ./collections/ -o ./public/data/ --force --pride-metadata
    """
    from quantms_portal.web.generator import StaticDataGenerator

    mode = "incremental" if incremental else "full"
    click.echo(f"Generating static portal data ({mode}) from {collections_root}...")
    gen = StaticDataGenerator(s3_base_url=s3_base_url, datasets_per_page=datasets_per_page)
    result = gen.build(collections_root, output, incremental=incremental)

    if pride_metadata:
        click.echo("Enriching with PRIDE metadata...")
        _enrich_with_pride(Path(output))

    if ai:
        click.echo("Generating AI descriptions...")
        _enrich_with_ai(Path(output))

    click.echo(f"Static data written to {result}")


def _enrich_with_pride(output_dir: Path):
    """Enrich dataset JSONs with PRIDE REST API metadata."""
    import json
    from qpx.core.pride import fetch_pride_metadata

    for ds_file in output_dir.rglob("datasets/*.json"):
        try:
            ds_data = json.loads(ds_file.read_text())
            accession = ds_data.get("accession", "")
            if not accession.startswith("PXD"):
                continue

            pride_meta = fetch_pride_metadata(accession)
            if pride_meta:
                if not ds_data.get("title") and pride_meta.get("title"):
                    ds_data["title"] = pride_meta["title"]
                if not ds_data.get("description") and pride_meta.get("projectDescription"):
                    ds_data["description"] = pride_meta["projectDescription"]
                ds_data["pride_url"] = f"https://www.ebi.ac.uk/pride/archive/projects/{accession}"
                if pride_meta.get("doi"):
                    ds_data["doi"] = pride_meta["doi"]

                ds_file.write_text(json.dumps(ds_data, indent=2, default=str))
                click.echo(f"  {accession}: enriched from PRIDE")
        except Exception as e:
            click.echo(f"  {ds_file.stem}: PRIDE fetch failed ({e})", err=True)


def _enrich_with_ai(output_dir: Path):
    """Enrich collection JSONs with AI-generated descriptions."""
    import json

    try:
        import anthropic
    except ImportError:
        click.echo("Install anthropic SDK: pip install anthropic", err=True)
        return

    client = anthropic.Anthropic()

    for coll_file in output_dir.glob("collections/*/collection.json"):
        try:
            coll_data = json.loads(coll_file.read_text())
            if coll_data.get("description"):
                continue  # already has description

            # Build context from collection data
            datasets_summary = "\n".join(
                f"- {d['accession']}: {d.get('title', 'N/A')} ({d.get('organism', 'N/A')}, {d.get('samples', 0)} samples)"
                for d in coll_data.get("datasets", [])
            )
            context = (
                f"Collection: {coll_data['name']}\n"
                f"Datasets ({coll_data['dataset_count']}):\n{datasets_summary}\n"
                f"Organisms: {', '.join(coll_data.get('organisms', []))}"
            )

            message = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=512,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Generate a concise title and description (2-3 sentences) for this "
                        f"proteomics data collection. Be scientific and specific.\n\n"
                        f"{context}\n\nFormat:\nTitle: ...\nDescription: ..."
                    ),
                }],
            )

            text = message.content[0].text
            for line in text.strip().split("\n"):
                if line.startswith("Title:"):
                    coll_data["title"] = line.replace("Title:", "").strip()
                elif line.startswith("Description:"):
                    coll_data["description"] = line.replace("Description:", "").strip()

            coll_file.write_text(json.dumps(coll_data, indent=2, default=str))
            click.echo(f"  {coll_data['name']}: AI description generated")
        except Exception as e:
            click.echo(f"  {coll_file.parent.name}: AI enrichment failed ({e})", err=True)
```

- [ ] **Step 2: Register in main.py**

Add to `qpx/cli/main.py`:

```python
from qpx.cli.portal import portal
qpx_main.add_command(portal)
```

- [ ] **Step 3: Test CLI manually**

```bash
cd /Users/yperez/work/quantms-workspace/quantms.io
python -m qpx.cli.main portal build-web ./msnet_qpx/../ -o /tmp/portal-data/ --s3-base-url s3://quantms-portal/collections
ls -la /tmp/portal-data/
cat /tmp/portal-data/registry.json | python -m json.tool
```

Expected: JSON files generated with correct collection and dataset data.

- [ ] **Step 4: Commit**

```bash
git add src/quantms_portal/cli/web.py
git commit -m "feat: add portal web build-web command for static JSON generation"
```

---

### Task 11: Integration test — full pipeline (index + static data)

**Files:**
- Modify: `tests/integration/test_collection_indexes.py`

- [ ] **Step 1: Add end-to-end test**

```python
# tests/integration/test_collection_indexes.py (append)

class TestStaticDataGenerator:
    def test_generates_complete_portal_data_from_msnet(self, tmp_path):
        """Full pipeline: generate static portal JSON from msnet_qpx."""
        from quantms_portal.web.generator import StaticDataGenerator

        # msnet_qpx sits alongside other collections in the workspace
        # Treat its parent as the collections root
        gen = StaticDataGenerator(s3_base_url="s3://quantms-portal/collections")
        gen.build(MSNET_PATH.parent, tmp_path)

        # registry.json exists and lists msnet
        import json
        registry = json.loads((tmp_path / "registry.json").read_text())
        assert registry["global_stats"]["total_collections"] >= 1
        assert "generated_at" in registry

        # collection.json exists
        # Find the msnet collection (name may be msnet_qpx)
        coll_names = [c["name"] for c in registry["collections"]]
        msnet_name = next(n for n in coll_names if "msnet" in n)
        coll_json_path = tmp_path / "collections" / msnet_name / "collection.json"
        assert coll_json_path.exists()

        coll = json.loads(coll_json_path.read_text())
        assert coll["dataset_count"] >= 1

        # Dataset JSONs exist
        for ds in coll["datasets"]:
            ds_path = tmp_path / "collections" / msnet_name / "datasets" / f"{ds['accession']}.json"
            assert ds_path.exists()
            ds_data = json.loads(ds_path.read_text())
            assert "samples_preview" in ds_data
            assert "download" in ds_data
            assert ds_data["collection"] == msnet_name

        # global-stats.json exists
        assert (tmp_path / "global-stats.json").exists()
```

- [ ] **Step 2: Run**

Run: `cd /Users/yperez/work/quantms-workspace/quantms-portal && python -m pytest tests/integration/test_collection_indexes.py::TestStaticDataGenerator -v`

- [ ] **Step 3: Commit**

```bash
git add tests/integration/test_collection_indexes.py
git commit -m "test: add integration test for full static portal data generation"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 0 | Project setup (pyproject.toml, package skeleton) | `pyproject.toml`, `src/quantms_portal/__init__.py` |
| 1 | BaseIndexBuilder ABC | `src/quantms_portal/indexes/base.py` |
| 2 | PeptideIndexBuilder | `src/quantms_portal/indexes/peptide.py` |
| 3 | ProteinIndexBuilder | `src/quantms_portal/indexes/protein.py` |
| 4 | MetadataIndexBuilder | `src/quantms_portal/indexes/metadata.py` |
| 5 | RegistryBuilder | `src/quantms_portal/indexes/registry.py` |
| 6 | CLI commands (index) | `src/quantms_portal/cli/index.py` |
| 7 | Integration tests (indexes) | `tests/integration/test_collection_indexes.py` |
| 8 | StaticDataGenerator | `src/quantms_portal/web/generator.py` |
| 9 | CLI commands (web) | `src/quantms_portal/cli/web.py` |
| 10 | Integration test (full pipeline) | `tests/integration/test_collection_indexes.py` |

**This package uses `qpx` as a dependency — it does NOT modify qpx.**

After completing this plan:
- `quantms-portal` is a pip-installable package with a `quantms-portal` CLI
- You can build indexes for msnet_qpx and absexpr_qpx locally
- Generate static JSON data for the Vue portal app
- Optionally enrich with PRIDE metadata and AI descriptions
- The Vue app (Plan 2) can be built immediately using these static JSON files — no backend needed for Phase 1
