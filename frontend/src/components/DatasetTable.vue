<template>
  <div class="dataset-table-wrap">
    <table class="dataset-table">
      <thead>
        <tr>
          <th>Accession</th>
          <th>Collection</th>
          <th>Title</th>
          <th>Organism</th>
          <th style="text-align:right">Samples</th>
          <th style="text-align:right">Proteins</th>
          <th style="text-align:right">PSMs</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ds in datasets" :key="ds.accession">
          <td>
            <router-link :to="`/collections/${ds.collection}/${ds.accession}`" class="accession-link">
              {{ ds.accession }}
            </router-link>
          </td>
          <td><span class="tag" :class="collectionTagClass(ds.collection)">{{ ds.collection }}</span></td>
          <td class="td-title">{{ ds.title }}</td>
          <td><span class="tag tag-blue">{{ ds.organism }}</span></td>
          <td class="td-num">{{ ds.samples || '—' }}</td>
          <td class="td-num">{{ ds.proteins || '—' }}</td>
          <td class="td-num">{{ ds.psms || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  datasets: { type: Array, required: true }
})

function collectionTagClass(name) {
  const map = { msnet: 'tag-blue', 'absolute-expression': 'tag-indigo', 'abs-expr': 'tag-indigo', 'differential-expression': 'tag-violet', 'diff-expr': 'tag-violet' }
  return map[name] || 'tag-blue'
}
</script>
