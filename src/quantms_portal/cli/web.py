import click
from pathlib import Path


@click.group()
def web():
    """Static web data generation commands."""
    pass


@web.command("build")
@click.argument("collections_root", type=str)
@click.option("--output", "-o", type=click.Path(), required=True, help="Local output directory for static JSON files.")
@click.option("--s3-base-url", default="s3://quantms/collections", help="S3 base URL for download links.")
@click.option("--ftp-base-url", default=None, help="Optional FTP/HTTP base URL for collection and dataset links.")
@click.option("--incremental/--force", default=True, help="Incremental: skip unchanged datasets. Force: regenerate all.")
@click.option("--datasets-per-page", default=50, help="Datasets per page in paginated listings.")
def build(collections_root, output, s3_base_url, ftp_base_url, incremental, datasets_per_page):
    """Generate static JSON data files for portal.quantms.org.

    Reads QPX parquet metadata from COLLECTIONS_ROOT (local or S3) and writes
    static JSON to OUTPUT (always local, for git commit).

    Examples:

        quantms-portal web build s3://quantms/collections/ -o ./public/data/

        quantms-portal web build s3://quantms/collections/ -o ./public/data/ --force

        quantms-portal web build ./local-collections/ -o ./public/data/
    """
    from quantms_portal.web.generator import StaticDataGenerator

    mode = "incremental" if incremental else "full"
    click.echo(f"Generating static portal data ({mode}) from {collections_root}...")
    gen = StaticDataGenerator(
        s3_base_url=s3_base_url,
        ftp_base_url=ftp_base_url,
        datasets_per_page=datasets_per_page,
    )
    result = gen.build(collections_root, output, incremental=incremental)
    click.echo(f"Static data written to {result}")
