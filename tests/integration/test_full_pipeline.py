"""Integration tests for the full portal pipeline: index build + static web generation."""
import json
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from pathlib import Path


def _make_collection_with_datasets(root: Path, coll_name: str, n_datasets: int = 2):
    """Create a collection directory with N synthetic datasets.

    Skips datasets that already exist so incremental-build tests can call this
    multiple times without changing the mtime of pre-existing parquet files.
    """
    coll_dir = root / coll_name
    for i in range(n_datasets):
        accession = f"PXD{100000 + i:06d}"
        ds_dir = coll_dir / accession
        # Skip if this dataset directory already has its parquets in place.
        if (ds_dir / f"{accession}.dataset.parquet").exists():
            continue
        ds_dir.mkdir(parents=True, exist_ok=True)

        pq.write_table(pa.table({
            "project_accession": [accession],
            "project_title": [f"Test Project {accession}"],
            "project_description": [f"Description for {accession}"],
        }), ds_dir / f"{accession}.dataset.parquet")

        pq.write_table(pa.table({
            "sample_id": [f"S{j}" for j in range(3)],
            "project_accession": [accession] * 3,
            "organism": ["Homo sapiens"] * 3,
            "characteristics_tissue": ["Liver", "Brain", "Heart"],
        }), ds_dir / f"{accession}.sample.parquet")

        pq.write_table(pa.table({
            "run_id": [f"R{j}" for j in range(2)],
            "sample_id": ["S0", "S1"],
            "instrument": ["Orbitrap", "Orbitrap"],
        }), ds_dir / f"{accession}.run.parquet")

    return coll_dir


class TestMetadataIndexBuild:
    """Test metadata index building with synthetic data."""

    def test_metadata_index_builds_from_synthetic_collection(self, tmp_path):
        from quantms_portal.indexes.metadata import MetadataIndexBuilder

        coll_dir = _make_collection_with_datasets(tmp_path, "test-coll", n_datasets=2)
        builder = MetadataIndexBuilder()
        result = builder.build(str(coll_dir), output_dir=str(tmp_path / "output"))

        assert (tmp_path / "output" / "metadata").is_dir()
        assert (tmp_path / "output" / "metadata" / "_metadata.parquet").exists()

    def test_metadata_index_contains_all_datasets(self, tmp_path):
        from quantms_portal.indexes.metadata import MetadataIndexBuilder

        coll_dir = _make_collection_with_datasets(tmp_path, "test-coll", n_datasets=3)
        builder = MetadataIndexBuilder()
        builder.build(str(coll_dir), output_dir=str(tmp_path / "output"))

        meta = pq.read_table(tmp_path / "output" / "metadata" / "_metadata.parquet").to_pandas()
        assert meta["total_entries"].iloc[0] == 3


class TestRegistryBuild:
    """Test registry building with synthetic data."""

    def test_registry_from_multiple_collections(self, tmp_path):
        from quantms_portal.indexes.registry import RegistryBuilder

        collections_root = tmp_path / "collections"
        _make_collection_with_datasets(collections_root, "coll-a", n_datasets=2)
        _make_collection_with_datasets(collections_root, "coll-b", n_datasets=3)

        builder = RegistryBuilder()
        result = builder.build(str(collections_root), output_path=str(tmp_path / "registry.parquet"))

        table = pq.read_table(result)
        assert table.num_rows == 2
        counts = dict(zip(table.column("name").to_pylist(), table.column("dataset_count").to_pylist()))
        assert counts["coll-a"] == 2
        assert counts["coll-b"] == 3


class TestStaticWebGeneration:
    """Test static web data generation with synthetic data."""

    def test_full_web_build_produces_all_files(self, tmp_path):
        from quantms_portal.web.generator import StaticDataGenerator

        collections_root = tmp_path / "collections"
        _make_collection_with_datasets(collections_root, "test-coll", n_datasets=3)

        output = tmp_path / "output"
        gen = StaticDataGenerator(datasets_per_page=2)
        gen.build(str(collections_root), str(output))

        # registry.json
        registry = json.loads((output / "registry.json").read_text())
        assert registry["global_stats"]["total_datasets"] == 3
        assert registry["global_stats"]["total_collections"] == 1

        # collection.json (summary, no datasets array)
        coll = json.loads((output / "collections" / "test-coll" / "collection.json").read_text())
        assert coll["dataset_count"] == 3
        assert coll["total_pages"] == 2
        assert "datasets" not in coll

        # Paginated pages
        page1 = json.loads((output / "collections" / "test-coll" / "datasets-page-1.json").read_text())
        assert len(page1["datasets"]) == 2
        page2 = json.loads((output / "collections" / "test-coll" / "datasets-page-2.json").read_text())
        assert len(page2["datasets"]) == 1

        # Dataset detail JSONs
        for ds in page1["datasets"] + page2["datasets"]:
            ds_path = output / "collections" / "test-coll" / "datasets" / f"{ds['accession']}.json"
            assert ds_path.exists()
            ds_data = json.loads(ds_path.read_text())
            assert ds_data["collection"] == "test-coll"
            assert "samples_preview" in ds_data
            assert "download" in ds_data

        # global-stats.json
        stats = json.loads((output / "global-stats.json").read_text())
        assert stats["datasets_by_organism"]["Homo sapiens"] == 3

        # .build-state.json
        assert (output / ".build-state.json").exists()

    def test_incremental_build_skips_unchanged(self, tmp_path):
        from quantms_portal.web.generator import StaticDataGenerator

        collections_root = tmp_path / "collections"
        _make_collection_with_datasets(collections_root, "test-coll", n_datasets=1)

        output = tmp_path / "output"
        gen = StaticDataGenerator()
        gen.build(str(collections_root), str(output), incremental=True)

        ds_path = output / "collections" / "test-coll" / "datasets" / "PXD100000.json"
        first_mtime = ds_path.stat().st_mtime

        # Add another dataset
        _make_collection_with_datasets(collections_root, "test-coll", n_datasets=2)

        import time
        time.sleep(0.1)

        gen2 = StaticDataGenerator()
        gen2.build(str(collections_root), str(output), incremental=True)

        # Original dataset file not rewritten
        assert ds_path.stat().st_mtime == first_mtime
        # New dataset exists
        assert (output / "collections" / "test-coll" / "datasets" / "PXD100001.json").exists()


class TestCLISmoke:
    """Smoke test the CLI commands work end-to-end."""

    def test_cli_web_build(self, tmp_path):
        from click.testing import CliRunner
        from quantms_portal.cli.main import main

        collections_root = tmp_path / "collections"
        _make_collection_with_datasets(collections_root, "test-coll", n_datasets=2)

        runner = CliRunner()
        result = runner.invoke(main, ["web", "build", str(collections_root), "-o", str(tmp_path / "output")])
        assert result.exit_code == 0, result.output
        assert (tmp_path / "output" / "registry.json").exists()

    def test_cli_index_build_registry(self, tmp_path):
        from click.testing import CliRunner
        from quantms_portal.cli.main import main

        collections_root = tmp_path / "collections"
        _make_collection_with_datasets(collections_root, "test-coll", n_datasets=1)

        runner = CliRunner()
        result = runner.invoke(main, ["index", "build-registry", str(collections_root), "--output", str(tmp_path / "registry.parquet")])
        assert result.exit_code == 0, result.output
        assert (tmp_path / "registry.parquet").exists()
