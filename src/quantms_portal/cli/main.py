import click


@click.group()
@click.version_option(package_name="quantms-portal")
def main():
    """quantms-portal: Tooling for portal.quantms.org."""
    pass


# Import and register subcommand groups
from quantms_portal.cli.index import index
from quantms_portal.cli.web import web

main.add_command(index)
main.add_command(web)
