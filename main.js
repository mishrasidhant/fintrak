import fs from 'fs/promises'
import { parseStatement } from './parser2.js'
// import { writeStatementCsv } from './writeCsv.js'

async function main(){
  const text = await fs.readFile('download_dir/txt/simplii-cheq.txt','utf-8')
  const configId = 'simplii_cheq'  // or detect from filename/first lines
  const { metadata, transactions } = await parseStatement(text, configId)
  console.log(metadata)
  console.log(transactions)
//   await writeStatementCsv('download_dir/csv/OUTPUT.csv', metadata, transactions)
//   console.log(`Wrote ${transactions.length} txs for ${metadata.accountNumber}`)
}

main().catch(console.error)
