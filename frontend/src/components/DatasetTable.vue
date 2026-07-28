<template>
  <div>
    <div v-if="searchable" class="filter-bar">
      <div class="filter-group">
        <input
          v-model="searchQuery"
          type="text"
          class="filter-search"
          placeholder="Search accession or title..."
          aria-label="Search datasets by accession or title"
        />
      </div>
      <span class="result-count"
        >{{ rows.length }} dataset{{ rows.length !== 1 ? "s" : "" }}</span
      >
    </div>

    <div
      v-if="loading"
      style="text-align: center; padding: 48px 0; color: var(--text-muted)"
    >
      Loading datasets…
    </div>

    <div v-else class="dataset-table-wrap">
      <table class="dataset-table">
        <thead>
          <tr>
            <th
              class="sortable"
              role="button"
              tabindex="0"
              :aria-sort="ariaSort('accession')"
              @click="clickSort('accession')"
              @keydown.enter.prevent="clickSort('accession')"
              @keydown.space.prevent="clickSort('accession')"
            >
              Accession {{ icon("accession") }}
            </th>
            <th
              class="sortable"
              role="button"
              tabindex="0"
              :aria-sort="ariaSort('title')"
              @click="clickSort('title')"
              @keydown.enter.prevent="clickSort('title')"
              @keydown.space.prevent="clickSort('title')"
            >
              Title {{ icon("title") }}
            </th>
            <template v-if="isMsnet">
              <th
                class="sortable"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('species')"
                @click="clickSort('species')"
                @keydown.enter.prevent="clickSort('species')"
                @keydown.space.prevent="clickSort('species')"
              >
                Species {{ icon("species") }}
              </th>
              <th
                class="sortable"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('instrument')"
                @click="clickSort('instrument')"
                @keydown.enter.prevent="clickSort('instrument')"
                @keydown.space.prevent="clickSort('instrument')"
              >
                Instrument {{ icon("instrument") }}
              </th>
              <th
                class="sortable"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('label')"
                @click="clickSort('label')"
                @keydown.enter.prevent="clickSort('label')"
                @keydown.space.prevent="clickSort('label')"
              >
                Label {{ icon("label") }}
              </th>
              <th
                class="sortable"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('acquisition_method')"
                @click="clickSort('acquisition_method')"
                @keydown.enter.prevent="clickSort('acquisition_method')"
                @keydown.space.prevent="clickSort('acquisition_method')"
              >
                Acquisition Method {{ icon("acquisition_method") }}
              </th>
              <th
                class="sortable num"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('psm_count')"
                @click="clickSort('psm_count')"
                @keydown.enter.prevent="clickSort('psm_count')"
                @keydown.space.prevent="clickSort('psm_count')"
              >
                PSMs {{ icon("psm_count") }}
              </th>
              <th
                class="sortable num"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('runs')"
                @click="clickSort('runs')"
                @keydown.enter.prevent="clickSort('runs')"
                @keydown.space.prevent="clickSort('runs')"
              >
                Runs {{ icon("runs") }}
              </th>
            </template>
            <template v-else>
              <th
                class="sortable num"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('samples')"
                @click="clickSort('samples')"
                @keydown.enter.prevent="clickSort('samples')"
                @keydown.space.prevent="clickSort('samples')"
              >
                Samples {{ icon("samples") }}
              </th>
              <th
                class="sortable num"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('runs')"
                @click="clickSort('runs')"
                @keydown.enter.prevent="clickSort('runs')"
                @keydown.space.prevent="clickSort('runs')"
              >
                Runs {{ icon("runs") }}
              </th>
              <th
                class="sortable num"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('feature_count')"
                @click="clickSort('feature_count')"
                @keydown.enter.prevent="clickSort('feature_count')"
                @keydown.space.prevent="clickSort('feature_count')"
              >
                Features {{ icon("feature_count") }}
              </th>
              <th
                class="sortable num"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('proteins')"
                @click="clickSort('proteins')"
                @keydown.enter.prevent="clickSort('proteins')"
                @keydown.space.prevent="clickSort('proteins')"
              >
                Proteins {{ icon("proteins") }}
              </th>
              <th
                class="sortable num"
                role="button"
                tabindex="0"
                :aria-sort="ariaSort('peptides')"
                @click="clickSort('peptides')"
                @keydown.enter.prevent="clickSort('peptides')"
                @keydown.space.prevent="clickSort('peptides')"
              >
                Peptides {{ icon("peptides") }}
              </th>
            </template>
          </tr>
          <tr v-if="isMsnet" class="filter-row">
            <th></th>
            <th></th>
            <th>
              <select v-model="filterSpecies" class="col-filter" aria-label="Filter by species">
                <option value="">All species</option>
                <option v-for="s in uniqueSpecies" :key="s" :value="s">
                  {{ s }}
                </option>
              </select>
            </th>
            <th>
              <select v-model="filterInstrument" class="col-filter" aria-label="Filter by instrument">
                <option value="">All instruments</option>
                <option v-for="i in uniqueInstruments" :key="i" :value="i">
                  {{ i }}
                </option>
              </select>
            </th>
            <th>
              <select v-model="filterLabel" class="col-filter" aria-label="Filter by label">
                <option value="">All labels</option>
                <option v-for="l in uniqueLabels" :key="l" :value="l">
                  {{ l }}
                </option>
              </select>
            </th>
            <th>
              <select v-model="filterAcquisitionMethod" class="col-filter" aria-label="Filter by acquisition method">
                <option value="">All acquisition methods</option>
                <option
                  v-for="a in uniqueAcquisitionMethods"
                  :key="a"
                  :value="a"
                >
                  {{ a }}
                </option>
              </select>
            </th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0">
            <td
              :colspan="isMsnet ? 8 : 7"
              style="
                text-align: center;
                padding: 32px;
                color: var(--text-muted);
              "
            >
              No datasets found.
            </td>
          </tr>
          <tr
            v-for="(ds, idx) in rows"
            :key="ds.accession + '-' + idx"
            :class="{ 'new-row': isNewDataset(ds) }"
            style="cursor: pointer"
            role="button"
            tabindex="0"
            :aria-label="`Open dataset ${ds.accession}`"
            @click="navigateTo(ds)"
            @keydown.enter="navigateTo(ds)"
            @keydown.space.prevent="navigateTo(ds)"
          >
            <td>
              <a
                v-if="ds.ftp_url"
                :href="ds.ftp_url"
                target="_blank"
                class="accession-link"
                @click.stop
                :title="'Open FTP: ' + ds.accession"
              >
                {{ ds.accession }}
                <span style="font-size: 10px; opacity: 0.5">&#8599;</span>
              </a>
              <router-link
                v-else
                :to="`/collections/${collectionName}/${ds.accession}`"
                class="accession-link"
                @click.stop
              >
                {{ ds.accession }}
              </router-link>
              <span v-if="isNewDataset(ds)" class="dataset-new-pill tag-news"
                >NEW</span
              >
            </td>
            <td class="td-title">{{ ds.title || ds.accession }}</td>
            <template v-if="isMsnet">
              <td>
                <span
                  v-if="ds.species"
                  class="tag tag-blue"
                  style="font-size: 11px"
                  >{{ ds.species }}</span
                >
                <span
                  v-else-if="ds.organisms && ds.organisms[0]"
                  class="tag tag-blue"
                  style="font-size: 11px"
                  >{{ ds.organisms[0] }}</span
                >
                <span v-else style="color: var(--text-muted)">—</span>
              </td>
              <td style="font-size: 13px; color: var(--text-secondary)">
                {{ ds.instrument || "—" }}
              </td>
              <td style="font-size: 13px; color: var(--text-secondary)">
                {{ ds.label || "—" }}
              </td>
              <td style="font-size: 13px; color: var(--text-secondary)">
                {{ ds.acquisition_method || "—" }}
              </td>
              <td class="td-num">{{ fmtNum(ds.psm_count) }}</td>
              <td class="td-num">{{ fmtNum(ds.runs) }}</td>
            </template>
            <template v-else>
              <td class="td-num">{{ fmtNum(ds.samples) }}</td>
              <td class="td-num">{{ fmtNum(ds.runs) }}</td>
              <td class="td-num">{{ fmtNum(ds.feature_count) }}</td>
              <td class="td-num">{{ fmtNum(ds.proteins) }}</td>
              <td class="td-num">{{ fmtNum(ds.peptides) }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";

const props = defineProps({
  datasets: { type: Array, required: true },
  // Optional: full dataset list (used to populate filter selects and full-table filtering)
  allDatasets: { type: Array, required: false },
  loading: { type: Boolean, default: false },
  searchable: { type: Boolean, default: true },
  collectionName: { type: String, default: "" },
});
const emit = defineEmits(["filtersChanged"]);

const router = useRouter();
const searchQuery = ref("");
const filterSpecies = ref("");
const filterInstrument = ref("");
const filterLabel = ref("");
const filterAcquisitionMethod = ref("");

// Sort state: key='' means unsorted
const sKey = ref("");
const sAsc = ref(true);

const isMsnet = computed(() => props.collectionName === "msnet");
const NUM = new Set(["psm_count", "feature_count", "runs", "samples", "proteins", "peptides"]);

watch(
  () => props.collectionName,
  () => {
    filterSpecies.value = "";
    filterInstrument.value = "";
    filterLabel.value = "";
    filterAcquisitionMethod.value = "";
    searchQuery.value = "";
    sKey.value = "";
  },
);

const uniqueSpecies = computed(() => {
  const src = props.allDatasets || props.datasets;
  const s = new Set();
  src.forEach((d) => {
    const v = d.species || (d.organisms && d.organisms[0]) || "";
    if (v) s.add(v);
  });
  return [...s].sort();
});

const uniqueInstruments = computed(() => {
  const s = new Set();
  props.datasets.forEach((d) => {
    if (d.instrument) s.add(d.instrument);
  });
  return [...s].sort();
});

const uniqueLabels = computed(() => {
  const src = props.allDatasets || props.datasets;
  const s = new Set();
  src.forEach((d) => {
    if (d.label) s.add(d.label);
  });
  return [...s].sort();
});

const uniqueAcquisitionMethods = computed(() => {
  const src = props.allDatasets || props.datasets;
  const s = new Set();
  src.forEach((d) => {
    if (d.acquisition_method) s.add(d.acquisition_method);
  });
  return [...s].sort();
});

// Final rows: only sort and prioritize NEW entries. Filtering is handled by parent.
const rows = computed(() => {
  const k = sKey.value;
  const asc = sAsc.value;
  const numeric = NUM.has(k);

  return props.datasets.slice().sort((a, b) => {
    const aNew = isNewDataset(a);
    const bNew = isNewDataset(b);
    if (aNew !== bNew) return aNew ? -1 : 1;
    if (!k) return 0;

    const va = a[k];
    const vb = b[k];

    if (numeric) {
      const numA = typeof va === "number" ? va : va ? parseFloat(va) : NaN;
      const numB = typeof vb === "number" ? vb : vb ? parseFloat(vb) : NaN;
      const aOk = !isNaN(numA) && numA > 0;
      const bOk = !isNaN(numB) && numB > 0;
      if (!aOk && !bOk) return 0;
      if (!aOk) return 1; // empty always last
      if (!bOk) return -1;
      return asc ? numA - numB : numB - numA;
    }

    const sa = String(va || "");
    const sb = String(vb || "");
    return asc ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
});

// Emit filter changes to parent so parent can filter the full dataset
function emitFilters() {
  emit("filtersChanged", {
    search: searchQuery.value,
    species: filterSpecies.value,
    instrument: filterInstrument.value,
    label: filterLabel.value,
    acquisition_method: filterAcquisitionMethod.value,
  });
}

// Watch filters and searchQuery to emit changes
watch([
  searchQuery,
  filterSpecies,
  filterInstrument,
  filterLabel,
  filterAcquisitionMethod,
], () => {
  emitFilters();
});

function clickSort(key) {
  if (sKey.value === key) {
    sAsc.value = !sAsc.value;
  } else {
    sKey.value = key;
    sAsc.value = !NUM.has(key); // numbers: desc first; text: asc first
  }
}

function icon(key) {
  if (sKey.value !== key) return " ▲▼";
  return sAsc.value ? " ▲" : " ▼";
}

// aria-sort value for a column header reflecting the current sort state.
function ariaSort(key) {
  if (sKey.value !== key) return "none";
  return sAsc.value ? "ascending" : "descending";
}

function fmtNum(n) {
  if (n == null || n === 0 || n === "") return "—";
  return Number(n).toLocaleString();
}

function isNewDataset(ds) {
  return Boolean(
    ds?.new ||
    ds?.news ||
    ds?.is_new ||
    ds?.is_updated ||
    ds?.updated ||
    ds?.highlight,
  );
}

function navigateTo(ds) {
  router.push(`/collections/${props.collectionName}/${ds.accession}`);
}
</script>

<style scoped>
.sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.sortable:hover {
  color: var(--indigo, #6366f1);
}
.num {
  text-align: right;
}
.filter-row th {
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.02);
}
.col-filter {
  width: 100%;
  font-size: 11px;
  padding: 3px 4px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 4px;
  background: #fff;
  color: var(--text-primary, #333);
  cursor: pointer;
  outline: none;
}
.col-filter:focus {
  border-color: var(--indigo, #6366f1);
}
</style>
