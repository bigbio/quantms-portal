<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">
      <div style="max-width: 640px; margin: 0 auto; text-align: center; padding: 60px 0;">
        <div style="font-size: 48px; margin-bottom: 20px;">🚧</div>
        <h1 style="font-size: 26px; font-weight: 800; color: var(--text-primary); margin-bottom: 12px;">
          API &amp; MCP — Coming Soon
        </h1>
        <p style="font-size: 15px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 28px;">
          The programmatic API and MCP (Model Context Protocol) server for AI agents are under active development.
          When ready, you'll be able to query all portal data via SQL, search peptides and proteins across collections,
          and integrate with Claude, ChatGPT, and other AI tools.
        </p>

        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; text-align: left; margin-bottom: 28px;">
          <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px; color: var(--text-primary);">Planned Features</h3>
          <ul style="font-size: 14px; color: var(--text-secondary); line-height: 2; padding-left: 20px;">
            <li><strong>SQL Query Endpoint</strong> — Write DuckDB SQL against QPX parquet collections</li>
            <li><strong>MCP Server</strong> — AI agents discover schema, write queries, get results</li>
            <li><strong>Peptide &amp; Protein Search</strong> — Search across collection indexes</li>
            <li><strong>Local MCP Package</strong> — <code>pip install quantms-mcp</code> for offline analysis</li>
          </ul>
        </div>

        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; text-align: left;">
          <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px; color: var(--text-primary);">Available Now</h3>
          <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 12px;">
            All portal data is available as static JSON files:
          </p>
          <pre style="background: #0f172a; border-radius: 8px; padding: 14px 18px; font-family: var(--mono); font-size: 13px; color: #e2e8f0; overflow-x: auto; line-height: 1.8;"><span style="color:#64748b;"># Registry of all collections</span>
curl https://portal.quantms.org/data/registry.json

<span style="color:#64748b;"># Collection dataset listing</span>
curl https://portal.quantms.org/data/collections/msnet/collection.json

<span style="color:#64748b;"># Individual dataset detail</span>
curl https://portal.quantms.org/data/collections/msnet/datasets/PXD000865.json</pre>
        </div>

        <div style="margin-top: 28px;">
          <a href="https://github.com/bigbio/quantms-portal" target="_blank"
             style="font-size: 14px; color: var(--indigo); font-weight: 600; text-decoration: none;">
            Follow development on GitHub →
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
