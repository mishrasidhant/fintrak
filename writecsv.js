// writeCsv.js
import { createObjectCsvWriter as createWriter } from 'csv-writer'
import fs from 'fs/promises'

export async function writeStatementCsv(
  outPath,
  metadata,
  transactions
){
  const csvWriter = createWriter({
    path: outPath,
    header: [
      { id: 'accountNumber',   title: 'Account Number' },
      { id: 'statementDate',   title: 'Statement Date' },
      { id: 'date',            title: 'Post Date' },
      { id: 'effDate',         title: 'Eff Date' },
      { id: 'description',     title: 'Description' },
      { id: 'amount',          title: 'Amount' },
      { id: 'balance',         title: 'Balance' }
    ]
  })

  // Prepend one “initial balance” row if you want:
  const rows = transactions.map(tx => ({
    accountNumber: metadata.accountNumber,
    statementDate: metadata.statementDate,
    date:           tx.date,
    effDate:        tx.effDate,
    description:    tx.description,
    amount:         tx.amount.toFixed(2),
    balance:        tx.balance != null ? tx.balance.toFixed(2) : ''
  }))

  await csvWriter.writeRecords(rows)
}
