<template>
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-cols">
        <div>
          <div class="footer-brand">quantms portal</div>
          <p class="footer-desc">
            Reanalysed public proteomics datasets in QPX format: browse, query and download them,
            or reach them from AI agents over MCP.
          </p>
        </div>
        <dl class="footer-links">
          <dt>Portal</dt>
          <dd>
            <router-link to="/apps/dataset-search">Datasets</router-link>
            <router-link to="/apps/peptide-search">Peptide search</router-link>
            <router-link to="/collections">Collections</router-link>
            <router-link to="/statistics">Statistics</router-link>
            <router-link to="/models">Models</router-link>
            <router-link to="/baseline">Baseline</router-link>
          </dd>
          <dt>Help</dt>
          <dd>
            <router-link to="/docs">Documentation</router-link>
            <a href="https://api.quantms.org/docs" target="_blank" rel="noopener">API &amp; MCP</a>
            <router-link to="/contact">Contact</router-link>
            <a href="https://github.com/bigbio/quantms-portal/issues" target="_blank" rel="noopener">Report an issue</a>
          </dd>
          <dt>quantms</dt>
          <dd>
            <a href="https://quantms.org" target="_blank" rel="noopener">quantms.org</a>
            <a href="https://qpx.quantms.org" target="_blank" rel="noopener">QPX format</a>
            <a href="https://github.com/bigbio/quantms" target="_blank" rel="noopener">GitHub</a>
          </dd>
          <dt>Data from</dt>
          <dd>
            <a href="https://www.proteomexchange.org" target="_blank" rel="noopener">ProteomeXchange</a>
            <a href="https://www.ebi.ac.uk/pride" target="_blank" rel="noopener">PRIDE Archive</a>
          </dd>
        </dl>
      </div>
      <div class="footer-bottom">
        &copy; {{ new Date().getFullYear() }} quantms project. Open source under the Apache 2.0 licence.
      </div>
    </div>
  </footer>
</template>
