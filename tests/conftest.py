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
    import shutil
    shutil.copytree(minimal_dataset, coll_dir / minimal_dataset.name)
    return coll_dir
