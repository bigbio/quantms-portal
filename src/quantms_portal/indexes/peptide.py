# src/quantms_portal/indexes/peptide.py
from quantms_portal.indexes.base import BaseIndexBuilder


class PeptideIndexBuilder(BaseIndexBuilder):
    """Builds a peptide index from PSM data across all datasets in a collection.

    Partitioned by first 2 amino acids of the sequence (~400 partitions).
    Aggregates per (sequence, peptidoform, project_accession).
    """

    index_type = "peptide"
    partition_column = "sequence_prefix"

    def build_sql(self, dataset_table_map: dict[int, list[str]]) -> str:
        psm_tables = []
        for idx, tables in dataset_table_map.items():
            psm_names = [t for t in tables if t.startswith("psm")]
            if psm_names:
                psm_tables.append(psm_names[0])

        if not psm_tables:
            raise ValueError("No PSM tables found in collection datasets")

        union_parts = []
        for table_name in psm_tables:
            union_parts.append(
                f"SELECT sequence, peptidoform, charge, "
                f"posterior_error_probability, protein_accessions, "
                f"is_decoy, project_accession "
                f"FROM {table_name}"
            )
        union_sql = " UNION ALL ".join(union_parts)

        return f"""
        SELECT
            sequence,
            peptidoform,
            project_accession,
            LIST(DISTINCT charge ORDER BY charge) AS charge_states,
            COUNT(*) AS spectra_count,
            MIN(posterior_error_probability) AS best_pep,
            LIST(DISTINCT protein_accessions) AS protein_accessions,
            LEFT(sequence, 2) AS sequence_prefix
        FROM ({union_sql}) AS all_psms
        WHERE is_decoy = false
        GROUP BY sequence, peptidoform, project_accession
        ORDER BY sequence_prefix, sequence
        """
