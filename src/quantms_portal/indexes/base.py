# src/quantms_portal/indexes/base.py
from abc import ABC, abstractmethod
from datetime import datetime, timezone

import pyarrow as pa

from quantms_portal import storage


class BaseIndexBuilder(ABC):
    """Base class for collection index builders.

    Subclasses define index_type, partition_column, and build_sql().
    The build() method runs the SQL against a DatasetCollection's DuckDB engine,
    writes partitioned parquet output, and generates _metadata.parquet.

    Supports both local and S3 paths for collection_path and output_dir.
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
        collection_path: str,
        output_dir: str | None = None,
        compression: str = "zstd",
    ) -> str:
        """Build the index from a collection directory (local or S3).

        Args:
            collection_path: path to the collection root (local or s3://).
            output_dir: where to write the index. Defaults to collection_path/_index/.
            compression: parquet compression codec.

        Returns:
            Path to the index directory (local or S3).
        """
        from qpx.dataset import Dataset
        from qpx.collection import DatasetCollection

        collection_path = str(collection_path).rstrip("/")
        if output_dir is None:
            output_dir = storage.join_path(collection_path, "_index")
        output_dir = str(output_dir).rstrip("/")
        index_dir = storage.join_path(output_dir, self.index_type)

        # Discover datasets: subdirectories containing *.dataset.parquet
        subdirs = storage.list_subdirs(collection_path)
        datasets = []
        dataset_accessions = []
        for name in subdirs:
            ds_path = storage.join_path(collection_path, name)
            if storage.has_dataset_parquet(ds_path):
                datasets.append(Dataset(ds_path))
                dataset_accessions.append(name)

        if not datasets:
            raise ValueError(f"No datasets found in {collection_path}")

        # Use DatasetCollection to register all datasets in DuckDB
        coll = DatasetCollection(datasets)
        try:
            raw_structure_names = coll.structure_names
            dataset_table_map = {
                idx: [f"{name}_{idx}" for name in names]
                for idx, names in raw_structure_names.items()
            }
            sql = self.build_sql(dataset_table_map)
            result = coll.sql(sql)
            table = result.to_arrow()
            total_entries = table.num_rows

            if total_entries == 0:
                raise ValueError(f"Index build produced 0 rows for {self.index_type}")

            # Write partitioned parquet or single file
            if self.partition_column and self.partition_column in table.column_names:
                storage.write_parquet_dataset(
                    table,
                    root_path=index_dir,
                    partition_cols=[self.partition_column],
                    compression=compression,
                )
            else:
                storage.write_parquet(
                    table,
                    storage.join_path(index_dir, "data.parquet"),
                    compression=compression,
                )

            # Write _metadata.parquet
            meta_table = pa.table({
                "index_type": [self.index_type],
                "built_at": [datetime.now(timezone.utc).isoformat()],
                "datasets_included": [dataset_accessions],
                "total_entries": [total_entries],
                "partition_column": [self.partition_column or ""],
                "compression": [compression],
            })
            storage.write_parquet(
                meta_table,
                storage.join_path(index_dir, "_metadata.parquet"),
            )
        finally:
            coll.close()

        return index_dir
