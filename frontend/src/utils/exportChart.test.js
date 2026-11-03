import { describe, it, expect } from 'vitest'
import { chartTable, toCsv } from './exportChart.js'

describe('toCsv', () => {
  it('writes objects by column and arrays as they are, quoting where needed', () => {
    expect(toCsv(['a', 'b'], [{ a: 1, b: 'x,y' }, [null, 'say "hi"'], { a: [1, 2] }]))
      .toBe('a,b\n1,"x,y"\n,"say ""hi"""\n1;2,\n')
  })
})

describe('chartTable', () => {
  it('turns chart labels and datasets into rows', () => {
    expect(chartTable({ labels: ['a', 'b'], datasets: [{ data: [1, 2] }] }, 'bin'))
      .toEqual({ columns: ['bin', 'value'], rows: [['a', 1], ['b', 2]] })
    expect(chartTable({ labels: ['a'], datasets: [{ label: 'X', data: [3] }, { data: [4] }] }).columns)
      .toEqual(['label', 'X', 'series_2'])
  })
})
