import json
import pyarrow as pa
import pyarrow.parquet as pq
from pathlib import Path


def _make_minimal_dataset(dataset_dir: Path, accession: str = "PXD000001"):
    """Helper: create a minimal QPX dataset with dataset + sample + run parquets."""
    dataset_dir.mkdir(parents=True, exist_ok=True)
    pq.write_table(pa.table({
        "project_accession": [accession],
        "project_title": [f"Test Dataset {accession}"],
        "project_description": ["A test dataset"],
    }), dataset_dir / f"{accession}.dataset.parquet")
    pq.write_table(pa.table({
        "sample_id": ["S1", "S2", "S3"],
        "project_accession": [accession] * 3,
        "organism": ["Homo sapiens"] * 3,
        "characteristics_tissue": ["Liver", "Brain", "Heart"],
    }), dataset_dir / f"{accession}.sample.parquet")
    pq.write_table(pa.table({
        "run_id": ["R1", "R2"],
        "sample_id": ["S1", "S2"],
        "instrument": ["Orbitrap", "Orbitrap"],
    }), dataset_dir / f"{accession}.run.parquet")
    (dataset_dir / f"{accession}.sdrf.tsv").write_text("source name\tcomment[data file]\nS1\tfile.raw\n")


def test_static_generator_creates_registry_json(tmp_path):
    from quantms_portal.web.generator import StaticDataGenerator
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


def test_static_generator_creates_collection_json_without_datasets_array(tmp_path):
    from quantms_portal.web.generator import StaticDataGenerator
    coll_dir = tmp_path / "collections" / "mytest"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")

    output = tmp_path / "output"
    gen = StaticDataGenerator()
    gen.build(tmp_path / "collections", output)

    coll = json.loads((output / "collections" / "mytest" / "collection.json").read_text())
    assert coll["name"] == "mytest"
    assert "datasets" not in coll  # summary only, no dataset array
    assert coll["dataset_count"] == 1
    assert coll["total_pages"] == 1


def test_static_generator_creates_dataset_json_with_sample_preview(tmp_path):
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
    assert ds_json["samples_total"] == 3
    assert "generated_at" in ds_json
    assert "download" in ds_json


def test_static_generator_emits_ftp_and_sdrf_links(tmp_path):
    from quantms_portal.web.generator import StaticDataGenerator

    coll_dir = tmp_path / "collections" / "msnet"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")

    output = tmp_path / "output"
    gen = StaticDataGenerator(
        ftp_base_url="https://ftp.pride.ebi.ac.uk/pub/databases/pride/resources/proteomes"
    )
    gen.build(tmp_path / "collections", output)

    registry = json.loads((output / "registry.json").read_text())
    assert registry["collections"][0]["title"] == "MS-Net"
    assert registry["collections"][0]["ftp_url"] == (
        "https://ftp.pride.ebi.ac.uk/pub/databases/pride/resources/proteomes/msnet/"
    )

    page1 = json.loads((output / "collections" / "msnet" / "datasets-page-1.json").read_text())
    assert page1["datasets"][0]["ftp_url"] == (
        "https://ftp.pride.ebi.ac.uk/pub/databases/pride/resources/proteomes/msnet/PXD000001"
    )

    ds_json = json.loads(
        (output / "collections" / "msnet" / "datasets" / "PXD000001.json").read_text()
    )
    assert ds_json["download"]["ftp_url"] == (
        "https://ftp.pride.ebi.ac.uk/pub/databases/pride/resources/proteomes/msnet/PXD000001"
    )
    assert ds_json["download"]["sdrf_url"] == (
        "https://ftp.pride.ebi.ac.uk/pub/databases/pride/resources/proteomes/msnet/PXD000001/PXD000001.sdrf.tsv"
    )
    assert ds_json["reanalysis_links"][0]["path"] == ds_json["download"]["ftp_url"]


def test_static_generator_creates_paginated_dataset_listing(tmp_path):
    from quantms_portal.web.generator import StaticDataGenerator
    coll_dir = tmp_path / "collections" / "mytest"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")
    _make_minimal_dataset(coll_dir / "PXD000002", "PXD000002")
    _make_minimal_dataset(coll_dir / "PXD000003", "PXD000003")

    output = tmp_path / "output"
    gen = StaticDataGenerator(datasets_per_page=2)
    gen.build(tmp_path / "collections", output)

    coll = json.loads((output / "collections" / "mytest" / "collection.json").read_text())
    assert coll["total_pages"] == 2
    assert coll["datasets_per_page"] == 2

    page1 = json.loads((output / "collections" / "mytest" / "datasets-page-1.json").read_text())
    assert len(page1["datasets"]) == 2
    assert page1["page"] == 1
    assert page1["total_pages"] == 2

    page2 = json.loads((output / "collections" / "mytest" / "datasets-page-2.json").read_text())
    assert len(page2["datasets"]) == 1
    assert page2["page"] == 2


def test_static_generator_creates_global_stats(tmp_path):
    from quantms_portal.web.generator import StaticDataGenerator
    coll_dir = tmp_path / "collections" / "mytest"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")

    output = tmp_path / "output"
    gen = StaticDataGenerator()
    gen.build(tmp_path / "collections", output)

    stats = json.loads((output / "global-stats.json").read_text())
    assert "datasets_by_organism" in stats
    assert "Homo sapiens" in stats["datasets_by_organism"]


def test_static_generator_incremental_skips_existing_datasets(tmp_path):
    from quantms_portal.web.generator import StaticDataGenerator
    coll_dir = tmp_path / "collections" / "mytest"
    _make_minimal_dataset(coll_dir / "PXD000001", "PXD000001")

    output = tmp_path / "output"
    gen = StaticDataGenerator()
    gen.build(tmp_path / "collections", output, incremental=True)
    ds_path = output / "collections" / "mytest" / "datasets" / "PXD000001.json"
    first_mtime = ds_path.stat().st_mtime

    _make_minimal_dataset(coll_dir / "PXD000002", "PXD000002")

    import time
    time.sleep(0.1)

    gen2 = StaticDataGenerator()
    gen2.build(tmp_path / "collections", output, incremental=True)

    assert ds_path.stat().st_mtime == first_mtime  # PXD000001 NOT rewritten
    assert (output / "collections" / "mytest" / "datasets" / "PXD000002.json").exists()

    build_state = json.loads((output / ".build-state.json").read_text())
    assert "PXD000001" in build_state
    assert "PXD000002" in build_state
