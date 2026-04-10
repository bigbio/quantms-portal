<template>
  <div class="section" style="padding-top: 100px;">
    <div class="container">
      <div class="section-header">
        <h2>API &amp; MCP Access</h2>
        <p>Query quantms Portal data programmatically using the Model Context Protocol or direct HTTP</p>
      </div>

      <div class="api-grid">
        <div class="api-card">
          <h3>MCP Server Setup</h3>
          <p>Add the quantms Portal MCP server to your Claude Desktop or AI agent configuration:</p>
          <pre class="code-block"><span class="code-comment">// claude_desktop_config.json</span>
{
  <span class="code-string">"mcpServers"</span>: {
    <span class="code-string">"quantms-portal"</span>: {
      <span class="code-string">"command"</span>: <span class="code-string">"uvx"</span>,
      <span class="code-string">"args"</span>: [<span class="code-string">"quantms-portal"</span>]
    }
  }
}</pre>
        </div>

        <div class="api-card">
          <h3>Python Client</h3>
          <p>Use the quantms-portal Python package to access data directly:</p>
          <pre class="code-block"><span class="code-keyword">from</span> quantms_portal <span class="code-keyword">import</span> PortalClient

client = PortalClient()

<span class="code-comment"># List collections</span>
collections = client.list_collections()

<span class="code-comment"># Search peptides across datasets</span>
hits = client.search_peptide(<span class="code-string">"TYQGSYGFR"</span>)
</pre>
        </div>

        <div class="api-card">
          <h3>Static JSON API</h3>
          <p>All portal data is available as static JSON files, hosted on GitHub Pages:</p>
          <pre class="code-block"><span class="code-comment"># Registry of all collections</span>
curl <span class="code-string">https://portal.quantms.org/data/registry.json</span>

<span class="code-comment"># Collection details</span>
curl <span class="code-string">https://portal.quantms.org/data/collections/msnet/index.json</span>
</pre>
        </div>

        <div class="api-card">
          <h3>MCP Tools Available</h3>
          <p>The MCP server exposes these tools for AI agents:</p>
          <ul style="font-size: 13px; color: var(--text-secondary); line-height: 2; padding-left: 20px;">
            <li><strong>list_collections</strong> — List all data collections</li>
            <li><strong>get_collection</strong> — Get collection metadata and datasets</li>
            <li><strong>search_peptide</strong> — Search for a peptide sequence</li>
            <li><strong>search_protein</strong> — Search for a protein accession</li>
            <li><strong>get_dataset</strong> — Get dataset metadata and files</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
