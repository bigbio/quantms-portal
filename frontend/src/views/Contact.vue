<template>
  <div class="section contact-page">
    <div class="container">
      <div class="section-header">
        <h2>Contact &amp; Contribute</h2>
        <p>Get in touch with the team or learn how to contribute to the project</p>
      </div>

      <!-- Contribution note -->
      <div class="contribution-note">
        <p>
          We also encourage the community that uses the same workflows to deposit
          and contribute to π-MSNet using the open-source and efficient
          <strong>quantms</strong> data processing workflow and the
          <strong>SDRF HUPO-PSI</strong> sample metadata standard. We have
          provided several methods to upload data such FTP depending on the
          endpoint.
        </p>
      </div>

      <!-- Contact cards -->
      <div class="contact-cards">
        <div class="contact-card">
          <div class="contact-avatar yasset"></div>
          <div class="contact-info">
            <h3>Yasset Perez-Riverol, Ph.D.</h3>
            <p class="contact-title">Principal Investigator</p>
            <p class="contact-org">
              European Molecular Biology Laboratory, European Bioinformatics
              Institute (EMBL-EBI), Wellcome Trust Genome Campus, Hinxton,
              Cambridge
            </p>
            <a class="contact-email" href="mailto:yperez@ebi.ac.uk"
              >yperez@ebi.ac.uk</a
            >
          </div>
        </div>

        <div class="contact-card">
          <div class="contact-avatar chengxin"></div>
          <div class="contact-info">
            <h3>Chengxin Dai</h3>
            <p class="contact-org">
              National Center for Protein Sciences, Beijing
            </p>
            <a class="contact-email" href="mailto:chengxin2024@126.com"
              >chengxin2024@126.com</a
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.contact-page {
  padding-top: 100px;
  min-height: 60vh;
}

/* Contribution note */
.contribution-note {
  background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
  border: 1px solid #c7d2fe;
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 40px;
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
}
.contribution-note p {
  margin: 0;
}
.contribution-note strong {
  color: #4f46e5;
}

/* Contact cards */
.contact-cards {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 640px;
}
.contact-card {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  transition: box-shadow 0.2s;
}
.contact-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
.contact-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  flex-shrink: 0;
}
.contact-avatar.yasset {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
}
.contact-avatar.chengxin {
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
}
.contact-info h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}
.contact-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: #6366f1;
}
.contact-org {
  margin: 0 0 8px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}
.contact-email {
  font-size: 13px;
  font-weight: 600;
  color: #4f46e5;
  text-decoration: none;
}
.contact-email:hover {
  text-decoration: underline;
}
</style>
