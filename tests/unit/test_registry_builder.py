# tests/unit/test_registry_builder.py
import pyarrow.parquet as pq
from pathlib import Path
import pyarrow as pa


def _make_dataset_dir(parent: Path, accession: str):
    """Helper to create a minimal dataset directory."""
    ds_dir = parent / accession
    ds_dir.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.table({
        "project_accession": [accession],
        "project_title": [f"Test {accession}"],
    }), ds_dir / f"{accession}.dataset.parquet")


def test_registry_builder_produces_parquet_with_collection_stats(tmp_path):
    from quantms_portal.indexes.registry import RegistryBuilder

    coll_dir = tmp_path / "collections" / "test-coll"
    _make_dataset_dir(coll_dir, "PXD000001")
    _make_dataset_dir(coll_dir, "PXD000002")

    builder = RegistryBuilder()
    result = builder.build(tmp_path / "collections", output_path=tmp_path / "registry.parquet")

    assert result.exists()
    table = pq.read_table(result)
    assert table.num_rows == 1
    assert table.column("name").to_pylist() == ["test-coll"]
    assert table.column("dataset_count").to_pylist() == [2]


def test_registry_parquet_has_required_columns(tmp_path):
    from quantms_portal.indexes.registry import RegistryBuilder

    coll_dir = tmp_path / "collections" / "mycoll"
    _make_dataset_dir(coll_dir, "PXD000001")

    builder = RegistryBuilder()
    builder.build(tmp_path / "collections", output_path=tmp_path / "registry.parquet")

    table = pq.read_table(tmp_path / "registry.parquet")
    required = {"name", "dataset_count", "updated"}
    assert required.issubset(set(table.column_names))


def test_registry_builder_handles_empty_collections(tmp_path):
    from quantms_portal.indexes.registry import RegistryBuilder

    (tmp_path / "collections").mkdir()

    builder = RegistryBuilder()
    result = builder.build(tmp_path / "collections", output_path=tmp_path / "registry.parquet")
    assert result.exists()
    table = pq.read_table(result)
    assert table.num_rows == 0


def test_registry_builder_multiple_collections(tmp_path):
    from quantms_portal.indexes.registry import RegistryBuilder

    _make_dataset_dir(tmp_path / "collections" / "coll-a", "PXD000001")
    _make_dataset_dir(tmp_path / "collections" / "coll-b", "PXD000002")
    _make_dataset_dir(tmp_path / "collections" / "coll-b", "PXD000003")

    builder = RegistryBuilder()
    result = builder.build(tmp_path / "collections", output_path=tmp_path / "registry.parquet")

    table = pq.read_table(result)
    assert table.num_rows == 2
    names = sorted(table.column("name").to_pylist())
    assert names == ["coll-a", "coll-b"]
    counts = dict(zip(table.column("name").to_pylist(), table.column("dataset_count").to_pylist()))
    assert counts["coll-a"] == 1
    assert counts["coll-b"] == 2
