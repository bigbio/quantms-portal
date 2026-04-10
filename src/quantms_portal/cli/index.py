import click
from pathlib import Path


@click.group()
def index():
    """Collection index building commands."""
    pass


@index.command("build")
@click.argument("collection_path", type=str)
@click.option(
    "--index-type",
    type=click.Choice(["peptide", "protein", "metadata", "all"]),
    required=True,
    help="Type of index to build.",
)
@click.option(
    "--output-dir",
    type=click.Path(),
    default=None,
    help="Output directory. Defaults to COLLECTION_PATH/_index/.",
)
def build(collection_path, index_type, output_dir):
    """Build a collection index from QPX datasets.

    COLLECTION_PATH is the root directory of a QPX collection containing
    dataset subdirectories with *.dataset.parquet files.

    Examples:

        quantms-portal index build ./msnet_qpx --index-type peptide

        quantms-portal index build ./msnet_qpx --index-type all
    """
    from quantms_portal.indexes import PeptideIndexBuilder, ProteinIndexBuilder, MetadataIndexBuilder

    builders = {
        "peptide": PeptideIndexBuilder,
        "protein": ProteinIndexBuilder,
        "metadata": MetadataIndexBuilder,
    }

    if index_type == "all":
        types_to_build = list(builders.keys())
    else:
        types_to_build = [index_type]

    for idx_type in types_to_build:
        click.echo(f"Building {idx_type} index for {collection_path}...")
        builder = builders[idx_type]()
        try:
            result_path = builder.build(collection_path, output_dir=output_dir)
            click.echo(f"  -> {result_path}")
        except ValueError as e:
            click.echo(f"  -> Skipped: {e}", err=True)

    click.echo("Done.")


@index.command("build-registry")
@click.argument("collections_root", type=str)
@click.option(
    "--output",
    type=click.Path(),
    default=None,
    help="Output path. Defaults to COLLECTIONS_ROOT/../registry.parquet.",
)
def build_registry(collections_root, output):
    """Build registry.parquet from a collections root directory.

    COLLECTIONS_ROOT is the directory containing collection subdirectories.

    Example:

        quantms-portal index build-registry ./collections/ --output ./registry.parquet
    """
    from quantms_portal.indexes.registry import RegistryBuilder

    click.echo(f"Building registry from {collections_root}...")
    builder = RegistryBuilder()
    result_path = builder.build(collections_root, output_path=output)
    click.echo(f"Registry written to {result_path}")
