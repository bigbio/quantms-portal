# Contribute

There are two ways to contribute to the portal: contributing **data** (getting a
dataset into the portal) and contributing **code or documentation**. Both are open,
and both are coordinated through GitHub.

## Contributing data

Data in the portal comes from **standardized reanalyses**, so contributing a
dataset is less about uploading files and more about producing results in the right
shape and publishing them through the portal.

At a high level:

1. **Produce results with the quantms workflow.** Reprocessing raw data with the
   [quantms workflow](https://github.com/bigbio/quantms) yields quantified results
   in the standardized [QPX](https://qpx.quantms.org) representation the portal
   indexes. Consistent processing is what makes datasets comparable.
2. **Publish through the portal as an authorized contributor.** Authorized
   contributors **authenticate with GitHub** and publish their results through the
   portal's publishing tooling. Once published, a dataset is indexed by the offline
   jobs (see [Infrastructure](/docs/infrastructure)) and becomes searchable.

The portal keeps **one canonical entry per unique dataset** and records how each
dataset was produced as provenance (see
[content-addressed dataset identity](/docs/data)), so re-publishing the same
results does not create duplicates.

### Publishing with the `quantms-portal` CLI

Publishing goes through the **`quantms-portal`** command-line tool. It signs you in
with your GitHub account and uploads through the portal's publishing gateway, so you
never handle storage credentials yourself — the gateway issues short-lived, scoped
upload links and finalizes the dataset for you.

1. **Install** the CLI from the
   [portal repository](https://github.com/bigbio/quantms-portal).
2. **Log in** with GitHub (a one-time device login opens in your browser):

   ```bash
   quantms-portal --gateway https://publish.quantms.org login
   quantms-portal whoami        # confirms who you're signed in as
   ```

   Publishing requires **contributor access**, managed through the project's GitHub
   organization. If `whoami` shows you lack access, open an issue to request it.
3. **Publish a dataset** — point the tool at the dataset directory and give its
   accession. It content-addresses the files (hashing them locally), uploads them,
   and registers the dataset:

   ```bash
   quantms-portal publish --path ./PXD012345 --accession PXD012345
   ```
4. **Add it to a collection** using the reference the publish step prints:

   ```bash
   quantms-portal collection add differential-expression --ref PXD012345/<hash>
   ```

Once published and added to a collection, the dataset is picked up by the portal's
offline indexing jobs and becomes searchable. `quantms-portal status` shows your
session, and `quantms-portal --help` lists every command.

**Large files.** The CLI currently uploads each file in a single request, so a
dataset containing an individual file larger than a few gigabytes will not upload
yet — multi-part upload for very large files is on the roadmap. If your dataset has
very large files, open an issue on the portal repository and the maintainers will
help get it in.

If you have a dataset you would like to see reanalyzed and added, open an issue in
the [quantms data portal repository](https://github.com/bigbio/quantms-portal) to
start the conversation.

## Contributing code or documentation

The portal is open-source. Contributions of all sizes are welcome — bug reports,
features, and documentation fixes.

**Repositories:**

- [quantms-portal](https://github.com/bigbio/quantms-portal) — the portal itself
  (web app, apps, and this documentation).
- [quantms](https://github.com/bigbio/quantms) — the analysis workflow.
- [quantms.io](https://github.com/bigbio/quantms.io) — the QPX data standard.
- [pmultiqc](https://github.com/bigbio/pmultiqc) — quality-control reporting.

**How to contribute:**

- **Report a bug or request a feature** — open a GitHub issue on the relevant
  repository, describing what you expected and what happened.
- **Open a pull request** — fork the repository, make your change on a branch, and
  open a PR describing the change and why.

### Editing these docs

This documentation is written as **Markdown files**, one per page, in the portal
repository under `frontend/src/docs/`. To fix a typo or improve a page:

1. Find the page's Markdown file (its name matches the page URL — for example this
   page is `contribute.md`).
2. Edit the Markdown.
3. Open a pull request.

Because each page is just Markdown, improving the docs is as easy as editing text —
no web development required. To add a **new** page, add a Markdown file and register
it in the docs navigation so it appears in the sidebar.
