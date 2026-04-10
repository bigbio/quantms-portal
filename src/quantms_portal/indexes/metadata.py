# src/quantms_portal/indexes/metadata.py
from quantms_portal.indexes.base import BaseIndexBuilder


class MetadataIndexBuilder(BaseIndexBuilder):
    """Builds an aggregated metadata index across all datasets in a collection.

    Not partitioned — produces a single parquet file with one row per dataset.
    Aggregates dataset + sample + run metadata across the collection.
    """

    index_type = "metadata"
    partition_column = ""  # not partitioned

    def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
        """Build SQL to aggregate metadata from dataset, sample, and run tables.

        Args:
            dataset_table_map: mapping of dataset index → list of registered table names.

        Returns:
            A SQL query string that aggregates one row per dataset.

        Raises:
            ValueError: if no dataset tables are found.
        """
        parts = []
        for idx, tables in dataset_table_map.items():
            dataset_t = next((t for t in tables if t.startswith("dataset")), None)
            sample_t = next((t for t in tables if t.startswith("sample")), None)
            run_t = next((t for t in tables if t.startswith("run")), None)

            if not dataset_t:
                continue

            sample_agg = ""
            if sample_t:
                sample_agg = f"""
                    (SELECT COUNT(*) FROM {sample_t}) AS n_samples,
                    (SELECT LIST(DISTINCT organism) FROM {sample_t}) AS organisms,
                """
            else:
                sample_agg = "0 AS n_samples, CAST([] AS VARCHAR[]) AS organisms,"

            run_agg = ""
            if run_t:
                run_agg = f"""
                    (SELECT COUNT(*) FROM {run_t}) AS n_runs
                """
            else:
                run_agg = "0 AS n_runs"

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
