#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateProgress(input) {
  if (input.schema !== 1 || input.metric !== 'engineering-checkpoint-coverage')
    throw Error('Unsupported progress schema')
  if (!/^[a-f0-9]{40}$/.test(input.main_sha) || !/^[a-f0-9]{40}$/.test(input.development_sha))
    throw Error('Pin both Git SHAs to audited code')
  const rows = input.requirements
  if (!Array.isArray(rows) || rows.length !== 18 ||
      new Set(rows.map(x => x.id)).size !== 18)
    throw Error('Expected 18 distinct original MVP requirements')
  for (const row of rows) {
    if (!/^MVP-[FTV][0-9]{3}$/.test(row.id) ||
        !['Gameplay', 'Technology', 'Experience'].includes(row.area) ||
        !Array.isArray(row.checkpoints) || row.checkpoints.length !== 4 ||
        row.checkpoints.some(s => typeof s !== 'string' || !s.trim()) ||
        !Array.isArray(row.evidence) || !row.evidence.length ||
        row.evidence.some(s => typeof s !== 'string' || !s.trim()) ||
        !Number.isInteger(row.main) || !Number.isInteger(row.development) ||
        row.main < 0 || row.development > 4 || row.development < row.main)
      throw Error('Invalid checkpoint data for ' + row.id)
  }
  if (input.accepted_requirements?.total !== 18 ||
      !Number.isInteger(input.accepted_requirements?.done) ||
      input.accepted_requirements.done < 0 || input.accepted_requirements.done > 18)
    throw Error('Acceptance must be a separate 18-requirement tally')
  return true
}

export function calculateProgress(data) {
  validateProgress(data)
  const total = data.requirements.length * 4
  const main = data.requirements.reduce((sum, row) => sum + row.main, 0)
  const dev = data.requirements.reduce((sum, row) => sum + row.development, 0)
  const percent = (num, den) => Number((100 * num / den).toFixed(1))
  return {
    main: { completed: main, total, percent: percent(main,total), sha: data.main_sha },
    development: { completed: dev, total, percent: percent(dev,total), sha: data.development_sha },
    gain: { checkpoints: dev-main, points: percent(dev-main,total) },
    acceptance: { ...data.accepted_requirements, percent: percent(data.accepted_requirements.done,18) }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const data = JSON.parse(readFileSync(new URL('../data/development-progress.json', import.meta.url),'utf8'))
    const result = calculateProgress(data)
    if (process.argv.includes('--json')) console.log(JSON.stringify(result,null,2))
    else {
      console.log('ACT OF STATE | development engineering checkpoints, not launch acceptance')
      console.log('main:        ' + result.main.completed + '/72 = ' + result.main.percent + '%')
      console.log('development: ' + result.development.completed + '/72 = ' + result.development.percent + '%')
      console.log('advance:     +' + result.gain.checkpoints + ' checkpoints, +' + result.gain.points + ' pp')
      console.log('acceptance:  ' + result.acceptance.done + '/18 = ' + result.acceptance.percent + '%')
    }
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
