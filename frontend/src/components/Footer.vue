<template>
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-cols">
        <div class="footer-col">
          <p class="footer-brand">quantms data portal</p>
          <p>
            The quantitative mass spectrometry data portal.
            Browse, query, and download standardized proteomics datasets in QPX format.
          </p>
        </div>
        <div class="footer-col">
          <h2>Portal</h2>
          <router-link to="/apps/dataset-search">Datasets</router-link>
          <router-link to="/collections">Collections</router-link>
          <router-link to="/apps/peptide-search">Peptide search</router-link>
          <router-link to="/applications">Applications</router-link>
          <router-link to="/statistics">Statistics</router-link>
          <router-link to="/models">Models</router-link>
          <router-link to="/baseline">Baseline</router-link>
        </div>
        <div class="footer-col">
          <h2>Developers</h2>
          <a href="https://api.quantms.org/docs" target="_blank" rel="noopener">API &amp; MCP</a>
          <router-link to="/docs">Documentation</router-link>
          <a href="https://github.com/bigbio/quantms-portal" target="_blank" rel="noopener">Portal source</a>
          <a href="https://github.com/bigbio/quantms-portal/issues" target="_blank" rel="noopener">Report an issue</a>
          <router-link to="/contact">Contact</router-link>
        </div>
        <div class="footer-col">
          <h2>Ecosystem</h2>
          <a href="https://quantms.org" target="_blank" rel="noopener">quantms.org</a>
          <a href="https://github.com/bigbio/quantms" target="_blank" rel="noopener">quantms pipeline</a>
          <a href="https://qpx.quantms.org" target="_blank" rel="noopener">QPX docs</a>
          <a href="https://www.proteomexchange.org" target="_blank" rel="noopener">ProteomeXchange</a>
          <a href="https://www.ebi.ac.uk/pride" target="_blank" rel="noopener">PRIDE Archive</a>
        </div>
      </div>
      <div class="footer-bottom">
        &copy; {{ new Date().getFullYear() }} quantms project. Open-source under Apache 2.0 License.
      </div>
    </div>
  </footer>
</template>
