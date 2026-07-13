# Download data

The portal is designed so that getting data out is straightforward, whether you
are clicking through the site or scripting an analysis. All served results are
open and standardized.

## Browse and follow dataset links

The simplest path:

1. Find what you want with [Dataset Search](/apps/dataset-search) or a
   [collection](/docs/collections).
2. Open the **dataset page**. It shows the dataset's metadata and links to the
   underlying result files.
3. Follow those links to view or download the files through the portal's public
   browse interface.

This is the happy path for exploring one dataset at a time: search → open →
download. You never need credentials to read and download public results.

## Programmatic access with the portal CLI

For scripted or bulk work, the portal ships a **command-line tool**
(`quantms-portal`) that provides programmatic access to portal data. Use it when
you want to pull data into a pipeline rather than click through the site.

The CLI is part of the
[quantms data portal repository](https://github.com/bigbio/quantms-portal), where
you will find installation and usage instructions.

## What you get

Downloaded results are in the standardized **QPX** representation used across the
quantms ecosystem, so the same schema applies to every dataset. See the
[QPX documentation](https://qpx.quantms.org) for the format, and
[Data](/docs/data) for what the portal holds.

## Reusing the data

Results are open for reuse. When you use portal data in your own work, please cite
the **original source study** for each dataset (linked from its dataset page)
alongside the portal, so credit flows to the groups that generated the raw data.
