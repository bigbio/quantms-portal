<template>
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-cols">
        <div class="footer-col">
          <div class="footer-brand">
            <span>quant<span style="color: var(--blue)">ms</span> Portal</span>
          </div>
          <p class="footer-desc">
            The quantitative mass spectrometry data portal.
            Browse, query, and download standardized proteomics datasets in QPX format.
          </p>
        </div>
        <div class="footer-col">
          <h4>Portal</h4>
          <router-link to="/collections">Collections</router-link>
          <router-link to="/search">Search</router-link>
          <router-link to="/statistics">Statistics</router-link>
          <router-link to="/expression">Expression</router-link>
          <router-link to="/api">API &amp; MCP</router-link>
        </div>
        <div class="footer-col">
          <h4>Ecosystem</h4>
          <a href="https://quantms.org" target="_blank" rel="noopener">quantms.org</a>
          <a href="https://qpx.quantms.org" target="_blank" rel="noopener">QPX Docs</a>
          <a href="https://github.com/bigbio/quantms" target="_blank" rel="noopener">GitHub</a>
        </div>
        <div class="footer-col">
          <h4>Resources</h4>
          <a href="https://www.proteomexchange.org" target="_blank" rel="noopener">ProteomeXchange</a>
          <a href="https://www.ebi.ac.uk/pride" target="_blank" rel="noopener">PRIDE Archive</a>
          <a href="https://github.com/bigbio/quantms" target="_blank" rel="noopener">quantms pipeline</a>
        </div>
      </div>
      <div class="footer-bottom">
        &copy; {{ new Date().getFullYear() }} quantms project. Open-source under Apache 2.0 License.
      </div>
    </div>
  </footer>
</template>
