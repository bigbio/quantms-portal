# tests/unit/test_index_builders.py
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from pathlib import Path


def test_base_index_builder_writes_partitioned_parquet(tmp_path, minimal_collection):
    """BaseIndexBuilder subclass writes partitioned parquet with metadata."""
    from quantms_portal.indexes.base import BaseIndexBuilder

    class DummyIndex(BaseIndexBuilder):
        index_type = "dummy"
        partition_column = "prefix"

        def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
            return "SELECT 'ACDEF' AS sequence, 'AC' AS prefix, 1 AS count"

    builder = DummyIndex()
    result = builder.build(minimal_collection, output_dir=tmp_path / "output")

    assert (tmp_path / "output" / "dummy").is_dir()
    metadata_path = tmp_path / "output" / "dummy" / "_metadata.parquet"
    assert metadata_path.exists()


def test_base_index_builder_metadata_parquet_has_required_fields(tmp_path, minimal_collection):
    """_metadata.parquet contains index_type, built_at, datasets_included, total_entries."""
    from quantms_portal.indexes.base import BaseIndexBuilder

    class DummyIndex(BaseIndexBuilder):
        index_type = "dummy"
        partition_column = "prefix"

        def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
            return "SELECT 'ACDEF' AS sequence, 'AC' AS prefix, 1 AS count"

    builder = DummyIndex()
    builder.build(minimal_collection, output_dir=tmp_path / "output")

    meta_df = pq.read_table(tmp_path / "output" / "dummy" / "_metadata.parquet").to_pandas()
    assert "index_type" in meta_df.columns
    assert "built_at" in meta_df.columns
    assert "total_entries" in meta_df.columns
    assert meta_df["index_type"].iloc[0] == "dummy"


def test_base_index_builder_returns_index_dir(tmp_path, minimal_collection):
    """build() returns the Path to the index directory."""
    from quantms_portal.indexes.base import BaseIndexBuilder

    class DummyIndex(BaseIndexBuilder):
        index_type = "dummy"
        partition_column = "prefix"

        def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
            return "SELECT 'ACDEF' AS sequence, 'AC' AS prefix, 1 AS count"

    builder = DummyIndex()
    result = builder.build(minimal_collection, output_dir=tmp_path / "output")

    assert isinstance(result, str)
    assert result == str(tmp_path / "output" / "dummy")


def test_base_index_builder_default_output_dir(tmp_path, minimal_collection):
    """When output_dir is None, index is written to collection_path/_index/."""
    from quantms_portal.indexes.base import BaseIndexBuilder

    class DummyIndex(BaseIndexBuilder):
        index_type = "dummy"
        partition_column = "prefix"

        def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
            return "SELECT 'ACDEF' AS sequence, 'AC' AS prefix, 1 AS count"

    builder = DummyIndex()
    result = builder.build(minimal_collection)

    assert result == str(minimal_collection / "_index" / "dummy")
    assert Path(result).is_dir()


def test_base_index_builder_no_partition(tmp_path, minimal_collection):
    """When partition_column is empty, writes a single data.parquet file."""
    from quantms_portal.indexes.base import BaseIndexBuilder

    class FlatIndex(BaseIndexBuilder):
        index_type = "flat"
        partition_column = ""

        def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
            return "SELECT 'ACDEF' AS sequence, 1 AS count"

    builder = FlatIndex()
    result = builder.build(minimal_collection, output_dir=tmp_path / "output")

    assert (Path(result) / "data.parquet").exists()


def test_base_index_builder_is_abstract():
    """BaseIndexBuilder cannot be instantiated directly."""
    from quantms_portal.indexes.base import BaseIndexBuilder

    with pytest.raises(TypeError):
        BaseIndexBuilder()


def test_base_index_builder_dataset_table_map_passed_to_sql(tmp_path, minimal_collection):
    """build_sql receives a non-empty dataset_table_map."""
    from quantms_portal.indexes.base import BaseIndexBuilder

    received_map = {}

    class SpyIndex(BaseIndexBuilder):
        index_type = "spy"
        partition_column = ""

        def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
            received_map.update(dataset_table_map)
            return "SELECT 'ACDEF' AS sequence, 1 AS count"

    builder = SpyIndex()
    builder.build(minimal_collection, output_dir=tmp_path / "output")

    assert len(received_map) > 0
    # Each dataset index maps to a list of table names
    for idx, tables in received_map.items():
        assert isinstance(idx, int)
        assert isinstance(tables, list)


def test_peptide_index_builder_sql_references_psm_tables():
    """PeptideIndexBuilder.build_sql generates SQL that queries PSM tables."""
    from quantms_portal.indexes.peptide import PeptideIndexBuilder

    builder = PeptideIndexBuilder()
    assert builder.index_type == "peptide"
    assert builder.partition_column == "sequence_prefix"

    table_map = {0: ["psm_0", "sample_0", "dataset_0"], 1: ["psm_1", "dataset_1"]}
    sql = builder.build_sql(table_map)

    assert "psm_0" in sql
    assert "psm_1" in sql
    assert "sequence_prefix" in sql
    assert "spectra_count" in sql
    assert "is_decoy" in sql.lower() or "decoy" in sql.lower()


def test_peptide_index_builder_raises_without_psm_tables():
    """Raises ValueError when no PSM tables are found."""
    from quantms_portal.indexes.peptide import PeptideIndexBuilder

    builder = PeptideIndexBuilder()
    with pytest.raises(ValueError, match="No PSM tables"):
        builder.build_sql({0: ["sample_0", "dataset_0"]})


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


def test_protein_index_builder_raises_without_pg_tables():
    """Raises ValueError when no PG tables are found."""
    from quantms_portal.indexes.protein import ProteinIndexBuilder

    builder = ProteinIndexBuilder()
    with pytest.raises(ValueError, match="No PG tables"):
        builder.build_sql({0: ["sample_0", "dataset_0"]})


def test_metadata_index_builder_sql_references_dataset_and_sample_tables():
    """MetadataIndexBuilder aggregates dataset + sample + run metadata."""
    from quantms_portal.indexes.metadata import MetadataIndexBuilder

    builder = MetadataIndexBuilder()
    assert builder.index_type == "metadata"
    assert builder.partition_column == ""

    table_map = {
        0: ["dataset_0", "sample_0", "run_0", "psm_0"],
        1: ["dataset_1", "sample_1", "run_1"],
    }
    sql = builder.build_sql(table_map)
    assert "dataset_0" in sql
    assert "sample_0" in sql
    assert "n_samples" in sql
    assert "organisms" in sql
    assert "n_runs" in sql


def test_metadata_index_builder_raises_without_dataset_tables():
    """Raises ValueError when no dataset tables are found."""
    from quantms_portal.indexes.metadata import MetadataIndexBuilder

    builder = MetadataIndexBuilder()
    with pytest.raises(ValueError, match="No dataset tables"):
        builder.build_sql({0: ["psm_0", "sample_0"]})
