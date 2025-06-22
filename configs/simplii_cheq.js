export default {
  "id": "simplii_chequing",
  "bank": "Simplii Financial",
  "accountType": "No-Fee Chequing",
  "dateFormats": ["MMM D", "MMM D, YYYY"], // format: 
  "metadataPatterns": [
    { "field": "accountNumber",
      "regexMark": /^account number:/i,
      "regexValue": /^\s*([0-9]+)\s*$/i },
    { "field": "statementDate",
      "regexMark": /^statement date:$/i,
      "regexValue": /^\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})$/i,
    },
    { "field": "period",
      "regexMark": /^statement period:$/i,
      "regexValue": /^\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*-\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})$/i,
    },
  ],
  "transactionSection": {
    "startRegex": /^details\s*trans\.\s*date/i,
    "endRegex": /^end of transactions$/i,
    "skipLineRegexes": [
      /^page\s*\d+\s*of\s*\d+/i,
      /^7010CA-/i
    ],
    "headerRepeatRegex": /^details\s*trans\.\s*date/i,
    "initialBalanceRegex": /^([A-Za-z]{3}\s+\d{1,2})\s+([A-Za-z]{3}\s+\d{1,2})\s+BALANCE FORWARD\s+([\d,]+\.\d{2})$/i,
    "transactionLineRegex": /^([A-Za-z]{3}\s+\d{1,2})\s+([A-Za-z]{3}\s+\d{1,2})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/i,
    "multiLineDescription": true
  },
  "creditCard": false
}