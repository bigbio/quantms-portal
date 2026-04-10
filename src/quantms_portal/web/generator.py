"""StaticDataGenerator: reads QPX parquet metadata from local or S3 paths,
writes static JSON files locally for the portal Vue app (GitHub Pages).

The source (collections on S3) and output (JSON for git repo) are intentionally
different storage layers. Data lives on S3; web collection is a derived artifact.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from quantms_portal import storage

_SAMPLE_PREVIEW_COLS = [
    "sample_id",
    "organism",
    "characteristics_tissue",
    "characteristics_disease",
    "characteristics_cell_line",
]
_SAMPLE_PREVIEW_MAX = 20


class StaticDataGenerator:
    """Generates static JSON files for the quantms portal from QPX collections.

    Reads parquet metadata from S3 or local paths.
    Writes JSON files to a local directory (for git commit → GitHub Pages).

    Parameters
    ----------
    s3_base_url:
        Base S3 URL used to construct download links in generated JSON.
    datasets_per_page:
        Number of datasets per paginated listing file.
    """

    def __init__(
        self,
        s3_base_url: str = "s3://quantms/collections",
        datasets_per_page: int = 50,
    ) -> None:
        self.s3_base_url = s3_base_url.rstrip("/")
        self.datasets_per_page = datasets_per_page

    def build(
        self,
        collections_root: str,
        output_dir: str | Path,
        incremental: bool = True,
    ) -> Path:
        """Build static JSON files from collections (local or S3).

        Args:
            collections_root: path to collections root (local or s3://).
            output_dir: LOCAL directory for generated JSON files.
            incremental: skip unchanged datasets when True.

        Returns:
            Path to output directory.
        """
        collections_root = str(collections_root).rstrip("/")
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Load build state for incremental mode
        build_state_path = output_dir / ".build-state.json"
        build_state: dict[str, str] = {}
        if incremental and build_state_path.exists():
            build_state = json.loads(build_state_path.read_text())

        now = _utcnow()
        registry_collections: list[dict[str, Any]] = []
        global_organism_counts: dict[str, int] = {}

        # List collections (works for both local and S3)
        coll_names = storage.list_subdirs(collections_root)

        for coll_name in coll_names:
            coll_path = storage.join_path(collections_root, coll_name)
            coll_meta, organism_counts = self._process_collection(
                coll_path, coll_name, output_dir, build_state, incremental, now
            )
            if coll_meta:
                registry_collections.append(coll_meta)
                for org, count in organism_counts.items():
                    global_organism_counts[org] = global_organism_counts.get(org, 0) + count

        # registry.json (always regenerated)
        total_datasets = sum(c.get("dataset_count", 0) for c in registry_collections)
        _write_json(
            output_dir / "registry.json",
            {
                "generated_at": now,
                "collections": registry_collections,
                "global_stats": {
                    "total_collections": len(registry_collections),
                    "total_datasets": total_datasets,
                },
            },
        )

        # portal-stats.json — lightweight summary for quantms.org landing page
        # Can be copied to quantms.org/data/portal-stats.json
        _write_json(
            output_dir / "portal-stats.json",
            {
                "generated_at": now,
                "datasets": total_datasets,
                "collections": len(registry_collections),
                "organisms": len(global_organism_counts),
                "proteins": 0,  # TODO: aggregate from collection stats when available
                "peptides": 0,
                "psms": 0,
                "source": "portal.quantms.org",
            },
        )

        # global-stats.json (always regenerated)
        _write_json(
            output_dir / "global-stats.json",
            {
                "generated_at": now,
                "datasets_by_organism": global_organism_counts,
            },
        )

        # Persist build state
        _write_json(build_state_path, build_state)

        return output_dir

    def _process_collection(
        self,
        coll_path: str,
        coll_name: str,
        output_dir: Path,
        build_state: dict[str, str],
        incremental: bool,
        now: str,
    ) -> tuple[dict[str, Any] | None, dict[str, int]]:
        """Process one collection (local or S3); returns registry entry + organism counts."""
        coll_out = output_dir / "collections" / coll_name
        ds_out = coll_out / "datasets"
        ds_out.mkdir(parents=True, exist_ok=True)

        # List dataset subdirectories
        ds_names = storage.list_subdirs(coll_path)

        dataset_summaries: list[dict[str, Any]] = []
        organisms_set: set[str] = set()
        organism_counts: dict[str, int] = {}

        for ds_name in ds_names:
            ds_path = storage.join_path(coll_path, ds_name)

            # Check if this is actually a dataset (has *.dataset.parquet)
            if not storage.has_dataset_parquet(ds_path):
                continue

            accession = ds_name
            ds_json_path = ds_out / f"{accession}.json"

            # Compute hash for incremental builds
            dataset_pq = storage.find_parquet(ds_path, "*.dataset.parquet")
            ds_hash = storage.get_file_hash(dataset_pq) if dataset_pq else ""

            if incremental and build_state.get(accession) == ds_hash and ds_json_path.exists():
                # Load existing JSON (dataset unchanged)
                ds_data = json.loads(ds_json_path.read_text())
            else:
                # Read from source (S3 or local) and generate JSON
                ds_data = self._process_dataset(ds_path, accession, coll_name, now)
                _write_json(ds_json_path, ds_data)
                build_state[accession] = ds_hash

            dataset_summaries.append(_dataset_summary(ds_data))
            for org in ds_data.get("organisms", []):
                organisms_set.add(org)
                organism_counts[org] = organism_counts.get(org, 0) + 1

        if not dataset_summaries:
            return None, {}

        # Paginated listings (always regenerated)
        total = len(dataset_summaries)
        total_pages = max(1, math.ceil(total / self.datasets_per_page))
        for page_num in range(1, total_pages + 1):
            start = (page_num - 1) * self.datasets_per_page
            end = start + self.datasets_per_page
            _write_json(
                coll_out / f"datasets-page-{page_num}.json",
                {
                    "page": page_num,
                    "total_pages": total_pages,
                    "datasets": dataset_summaries[start:end],
                },
            )

        # collection.json — summary only, NO datasets array
        coll_meta: dict[str, Any] = {
            "name": coll_name,
            "title": coll_name,
            "description": "",
            "generated_at": now,
            "dataset_count": total,
            "total_pages": total_pages,
            "datasets_per_page": self.datasets_per_page,
            "organisms": sorted(organisms_set),
            "stats": {},
            "indexes": [],
        }
        _write_json(coll_out / "collection.json", coll_meta)

        return (
            {
                "name": coll_name,
                "dataset_count": total,
                "total_pages": total_pages,
            },
            organism_counts,
        )

    def _process_dataset(
        self,
        ds_path: str,
        accession: str,
        collection_name: str,
        now: str,
    ) -> dict[str, Any]:
        """Read dataset/sample/run parquets (local or S3) and return detail dict."""
        structures: list[str] = []
        dataset_info: dict[str, Any] = {}
        samples_preview: list[dict[str, Any]] = []
        samples_total = 0
        runs_total = 0
        organisms: list[str] = []

        # dataset parquet
        dataset_pq = storage.find_parquet(ds_path, "*.dataset.parquet")
        if dataset_pq:
            structures.append("dataset")
            tbl = storage.read_parquet(dataset_pq)
            dataset_info = {col: tbl.column(col)[0].as_py() for col in tbl.schema.names}

        # sample parquet
        sample_pq = storage.find_parquet(ds_path, "*.sample.parquet")
        if sample_pq:
            structures.append("sample")
            tbl = storage.read_parquet(sample_pq)
            samples_total = len(tbl)
            preview_cols = [c for c in _SAMPLE_PREVIEW_COLS if c in tbl.schema.names]
            preview_tbl = tbl.select(preview_cols).slice(0, _SAMPLE_PREVIEW_MAX)
            preview_dict = preview_tbl.to_pydict()
            samples_preview = [
                {col: preview_dict[col][i] for col in preview_cols}
                for i in range(len(preview_tbl))
            ]
            if "organism" in tbl.schema.names:
                organisms = sorted({v.as_py() for v in tbl.column("organism") if v.as_py()})

        # run parquet
        run_pq = storage.find_parquet(ds_path, "*.run.parquet")
        if run_pq:
            structures.append("run")
            tbl = storage.read_parquet(run_pq)
            runs_total = len(tbl)

        # Check for other structures (psm/, feature/, pg parquets)
        for suffix in ("psm", "feature", "pg", "provenance", "ontology"):
            if storage.find_parquet(ds_path, f"*.{suffix}.parquet"):
                if suffix not in structures:
                    structures.append(suffix)

        title = dataset_info.get("project_title", accession)
        description = dataset_info.get("project_description", "")

        return {
            "accession": accession,
            "collection": collection_name,
            "generated_at": now,
            "title": title,
            "description": description,
            "organisms": organisms,
            "structures": structures,
            "samples_preview": samples_preview,
            "samples_total": samples_total,
            "runs_total": runs_total,
            "download": {
                "s3_url": f"{self.s3_base_url}/{collection_name}/{accession}",
                "qpx_command": f"qpx pull {collection_name}/{accession}",
            },
        }


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dataset_summary(ds_data: dict[str, Any]) -> dict[str, Any]:
    """Return a compact summary dict for paginated listings."""
    return {
        "accession": ds_data.get("accession", ""),
        "title": ds_data.get("title", ""),
        "organisms": ds_data.get("organisms", []),
        "samples": ds_data.get("samples_total", 0),
        "runs": ds_data.get("runs_total", 0),
        "collection": ds_data.get("collection", ""),
    }


def _write_json(path: Path, data: Any) -> None:
    """Write data as pretty-printed JSON to a local path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str))
