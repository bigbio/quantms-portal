# src/quantms_portal/indexes/registry.py
from datetime import datetime, timezone
from pathlib import Path

import pyarrow as pa

from quantms_portal import storage


class RegistryBuilder:
    """Builds registry.parquet from a collections root directory (local or S3).

    Scans each collection subdirectory, counts datasets, and optionally
    reads _index/metadata/ for richer info.
    """

    def build(
        self,
        collections_root: str,
        output_path: str | None = None,
    ) -> str:
        """Build the registry from a collections root directory.

        Args:
            collections_root: path to collections root (local or s3://).
            output_path: where to write registry.parquet (local or s3://).

        Returns:
            Path to the generated registry.parquet file.
        """
        collections_root = str(collections_root).rstrip("/")
        if output_path is None:
            if storage.is_s3_path(collections_root):
                # Write alongside the collections dir on S3
                parent = "/".join(collections_root.split("/")[:-1])
                output_path = storage.join_path(parent, "registry.parquet")
            else:
                output_path = str(Path(collections_root).parent / "registry.parquet")

        rows = []
        coll_names = storage.list_subdirs(collections_root)
        for coll_name in coll_names:
            coll_path = storage.join_path(collections_root, coll_name)
            row = self._scan_collection(coll_path, coll_name)
            if row:
                rows.append(row)

        if not rows:
            table = pa.table({
                "name": pa.array([], type=pa.string()),
                "title": pa.array([], type=pa.string()),
                "description": pa.array([], type=pa.string()),
                "type": pa.array([], type=pa.string()),
                "dataset_count": pa.array([], type=pa.int32()),
                "organisms": pa.array([], type=pa.list_(pa.string())),
                "updated": pa.array([], type=pa.string()),
            })
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

        storage.write_parquet(table, output_path)
        return output_path

    def _scan_collection(self, coll_path: str, coll_name: str) -> dict | None:
        """Scan a collection (local or S3) and return summary stats."""
        # Count datasets
        ds_names = storage.list_subdirs(coll_path)
        dataset_count = 0
        for ds_name in ds_names:
            ds_path = storage.join_path(coll_path, ds_name)
            if storage.has_dataset_parquet(ds_path):
                dataset_count += 1

        if dataset_count == 0:
            return None

        row: dict = {"name": coll_name, "dataset_count": dataset_count}

        # Try to read metadata index for richer info
        meta_pq = storage.join_path(coll_path, "_index", "metadata", "metadata.parquet")
        try:
            meta_table = storage.read_parquet(meta_pq)
            meta_df = meta_table.to_pandas()
            if "organisms" in meta_df.columns:
                all_orgs = []
                for org_list in meta_df["organisms"].dropna():
                    if isinstance(org_list, list):
                        all_orgs.extend(org_list)
                row["organisms"] = list(set(all_orgs))
        except Exception:
            pass

        return row
