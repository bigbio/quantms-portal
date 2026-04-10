# src/quantms_portal/indexes/protein.py
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
