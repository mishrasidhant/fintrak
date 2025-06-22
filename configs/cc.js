export default {
  "id": "bankx_card",
  "bank": "Bank X",
  "accountType": "Card",
  "dateFormats": ["MM/DD/YY"],                     // e.g. "12/20/24"
  "metadataPatterns": [
    { "field": "accountNumber",
      "regex": /^Account Number:\s*([0-9X\s]+)$/i },
    { "field": "statementDate",
      "regex": /^Statement Date:\s*(\d{1,2}\/\d{1,2}\/\d{2})$/i },
    { "field": "period",
      "regex": /^Statement Period:\s*(\d{1,2}\/\d{1,2}\/\d{2})\s*to\s*(\d{1,2}\/\d{1,2}\/\d{2})$/i }
  ],
  "transactionSection": {
    "startRegex": /^Statement Period:/i,
    "endRegex": /^Your Minimum Payment Due Date/i,
    "skipLineRegexes": [ /^See reverse/i ],
    "recordSeparatorRegex": /^\s*$/i,              // blank line
    "recordFields": [                              // in‐order per record
      { "name": "postDate",   "regex": /^(\d{1,2}\/\d{1,2}\/\d{2})$/ },
      { "name": "effDate",    "regex": /^(\d{1,2}\/\d{1,2}\/\d{2})$/ },
      { "name": "reference",  "regex": /^(.+)$/ },
      { "name": "merchant",   "regex": /^(.+)$/ },
      { "name": "region",     "regex": /^([A-Z]{2})$/ },
      { "name": "code",       "regex": /^(\d{4})$/ },
      { "name": "amount",     "regex": /^\$?([\d,]+\.\d{2})$/ }
    ]
  },
  "creditCard": true
}