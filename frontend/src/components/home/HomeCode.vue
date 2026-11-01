<template>
  <section class="section code-section" aria-labelledby="code-title">
    <div class="container">
      <h2 id="code-title" class="rule-title">Use the data from your code or your AI assistant</h2>
      <p class="section-lede">
        Everything in the portal is open: no account and no key. The web apps call the same REST API you can call,
        and an MCP endpoint gives AI assistants the same searches as tools.
      </p>

      <div class="code-cols">
        <div class="code-col">
          <h3>REST API</h3>
          <p>Plain HTTPS returning JSON. Each app has its own interactive reference.</p>
          <div v-for="ex in restExamples" :key="ex.title" class="code-block">
            <div class="code-bar">
              <span>{{ ex.title }}</span>
              <button type="button" class="code-copy" @click="copy(ex.code, ex.title)">{{ copied === ex.title ? 'Copied' : 'Copy' }}</button>
            </div>
            <pre><code>{{ ex.code }}</code></pre>
          </div>
          <p class="code-links">
            <a :href="apiDocsUrl" target="_blank" rel="noopener">API reference ↗</a>
            <router-link to="/docs/download">Download whole datasets</router-link>
          </p>
        </div>

        <div class="code-col">
          <h3>MCP for AI assistants</h3>
          <p>
            Connect Claude or any MCP client and ask in plain language, for example
            <em>“In which tissues is phosphorylated tau observed?”</em> The assistant calls the portal tools and answers from the data.
          </p>
          <div v-for="ex in mcpExamples" :key="ex.title" class="code-block">
            <div class="code-bar">
              <span>{{ ex.title }}</span>
              <button type="button" class="code-copy" @click="copy(ex.code, ex.title)">{{ copied === ex.title ? 'Copied' : 'Copy' }}</button>
            </div>
            <pre><code>{{ ex.code }}</code></pre>
          </div>
          <p class="code-tools">
            Tools: search peptides, search proteins, protein and peptide profiles, protein coverage map, modifications,
            list collections, search datasets.
          </p>
          <p class="code-links">
            <router-link to="/docs/ai-mcp">How the MCP tools work</router-link>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { copyText } from '../../utils/clipboard.js'
import { API_BASE, API_DOCS_URL } from '../../config.js'

const apiDocsUrl = API_DOCS_URL
const copied = ref('')

const restExamples = [
  {
    title: 'Datasets that contain a protein (shell)',
    code: `curl "${API_BASE}/peptide-search/search/protein?query=GAPDH"`,
  },
  {
    title: 'Protein profile (Python)',
    code: `import requests

r = requests.get("${API_BASE}/peptide-search/protein/profile",
                 params={"accession": "P10636"})
p = r.json()
print(p["name"], p["coverage_pct"], "% covered in", p["n_datasets"], "datasets")`,
  },
  {
    title: 'Search the dataset catalogue (shell)',
    code: `curl "${API_BASE}/dataset-search/datasets?q=cancer&page_size=20"`,
  },
]

const mcpExamples = [
  {
    title: 'Claude Code',
    code: `claude mcp add --transport http quantms-peptides ${API_BASE}/peptide-search/mcp
claude mcp add --transport http quantms-datasets ${API_BASE}/dataset-search/mcp`,
  },
  {
    title: 'Other MCP clients (JSON config)',
    code: `{
  "mcpServers": {
    "quantms-peptides": { "type": "http", "url": "${API_BASE}/peptide-search/mcp" },
    "quantms-datasets": { "type": "http", "url": "${API_BASE}/dataset-search/mcp" }
  }
}`,
  },
]

async function copy(text, key) {
  if (await copyText(text)) {
    copied.value = key
    setTimeout(() => {
      if (copied.value === key) copied.value = ''
    }, 1500)
  }
}
</script>

<style scoped>
.code-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 48px;
}
.code-col h3 {
  font-size: 19px;
  font-weight: 600;
  margin-bottom: 6px;
}
.code-col > p {
  color: var(--text-secondary);
  margin-bottom: 16px;
}
.code-block {
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 14px;
  overflow: hidden;
}
.code-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--bg-alt);
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-secondary);
}
.code-copy {
  font: inherit;
  font-size: 12px;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--brand);
  cursor: pointer;
}
.code-copy:hover {
  border-color: var(--brand);
}
.code-block pre {
  margin: 0;
  padding: 12px 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--brand-ink);
  color: #e6edf5;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.55;
}
.code-tools {
  font-size: 14px;
  color: var(--text-secondary);
}
.code-links {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  font-size: 14px;
  font-weight: 500;
}
.code-links a {
  color: var(--brand);
}
@media (max-width: 900px) {
  .code-cols {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}
</style>
