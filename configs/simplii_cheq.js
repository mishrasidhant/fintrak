<<<<<<< HEAD
export default {\n  \"id\": \"simplii_chequing\",\n  \"bank\": \"Simplii Financial\",\n  \"accountType\": \"No-Fee Chequing\",\n  \"dateFormats\": [\"MMM D\", \"MMM D, YYYY\"], // format: \n  \"metadataPatterns\": [\n    { \"field\": \"accountNumber\",\n      \"regexMark\": /^account number:/i,\n      \"regexValue\": /^\\s*([0-9]+)\\s*$/i },\n    { \"field\": \"statementDate\",\n      \"regexMark\": /^statement date:$/i,\n      \"regexValue\": /^\\s*([A-Za-z]+\\s+\\d{1,2},\\s+\\d{4})$/i,\n    },\n    { \"field\": \"period\",\n      \"regexMark\": /^statement period:$/i,\
      \"regexValue\": /^\\s*([A-Za-z]+\\s+\\d{1,2},\\s+\\d{4})\\s*-\\s*([A-Za-z]+\\s+\\d{1,2},\\s+\\d{4})$/i,\n    },\n  ],\n  \"transactionSection\": {\n    \"startRegex\": /^details$/i,\n    \"endRegex\": /^end of transactions$/i,\n    \"skipLineRegexes\": [\n      /^page\\s*\\d+\\s*of\\s*\\d+/i,\n      /^7010CA-/i\n    ],\n    \"headerRepeatRegex\": /^details\\s*trans\\.\\s*date/i,\n    \"initialBalanceRegex\": /^([A-Za-z]{3} \\d{1,2})\\s*\\n\\s*([A-Za-z]{3} \\d{1,2})\\s*\\n\\s*BALANCE FORWARD\\s*\\n\\s*([\\d,]+\\.\\d{2})/im,\n    \"transactionLineRegex\": /^([A-Za-z]{3} \\d{1,2})\\s*\\n\\s*([A-Za-z]{3} \\d{1,2})\\s*\\n\\s*([\\s\\S]+?)\\s*\\n\\s*([\\d,]+\\.\\d{2})\\s*\\n\\s*([\\d,]+\\.\\d{2})\\s*\\n\\s*([\\d,]+\\.\\d{2})/im,\n    \"multiLineTransaction\": true,\n    \"multiLineDescription\": true\n  },\n  \"creditCard\": false\n}
=======
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
    "startRegex": /^details$/i,
    "endRegex": /^end of transactions$/i,
    "skipLineRegexes": [
      /^page\s*\d+\s*of\s*\d+/i,
      /^7010CA-/i
    ],
    "headerRepeatRegex": /^details\s*trans\.\s*date/i,
    "initialBalanceRegex": /^([A-Za-z]{3} \d{1,2})\s*\n\s*([A-Za-z]{3} \d{1,2})\s*\n\s*BALANCE FORWARD\s*\n\s*([\d,]+\.\d{2})/im,
    "transactionLineRegex": /^([A-Za-z]{3} \d{1,2})\s*\n\s*([A-Za-z]{3} \d{1,2})\s*\n\s*([\s\S]+?)\s*\n\s*([\d,]+\.\d{2})\s*\n\s*([\d,]+\.\d{2})\s*\n\s*([\d,]+\.\d{2})/im,
    "multiLineTransaction": true,
    "multiLineDescription": true
  },
  "creditCard": false
}
>>>>>>> 49e1f93 (feat: Add multi-line transaction parsing for Simplii Financial)
