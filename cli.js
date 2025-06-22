#!/usr/bin/env node
import fs from 'fs/promises'
import { program } from 'commander'
import { parseStatement } from './parseStatement.js'
import { writeStatementCsv } from './writeCsv.js'

program
  .argument('<txtFile>')
  .argument('<configId>')
  .argument('[outCsv]')
  .action(async (txtFile, configId, outCsv='out.csv') => {
    const text = await fs.readFile(txtFile,'utf-8')
    const { metadata, transactions } = await parseStatement(text, configId)
    await writeStatementCsv(outCsv, metadata, transactions)
    console.log(`✅ ${outCsv} ← ${transactions.length} txs (${configId})`)
  })
  .parse(process.argv)
