<<<<<<< HEAD
// parseStatement.js\n  import fs from 'fs/promises'\n  import dayjs from 'dayjs'\n  import customParseFormat from 'dayjs/plugin/customParseFormat.js'\n  dayjs.extend(customParseFormat)\n\n  async function loadConfig(id) {\n    //   return JSON.parse(\n    //     await fs.readFile(new URL(`./configs/${id}.json`, import.meta.url), 'utf-8')\n    //   )\n    const mod = await import(new URL(`./configs/${id}.js`,\n      import.meta.url))\n    return mod.default\n  }\n\n  // Given “Dec 30” or “12/20/24” + formats + statement period,\n  // return ISO “YYYY-MM-DD”.\n  function parseDate(str, formats, periodStart, periodEnd) {\n    try {\n      for (let fmt of formats) {\n        let d = dayjs(str, fmt, true)\n        if (d.isValid()) {\n          if (!fmt.includes('Y')) {\n            // infer year: if month < start.month, use end.year, else start.year\n            const s = dayjs(periodStart),\n              e = dayjs(periodEnd)\n            d = d.month() < s.month() ? d.year(e.year()) : d.year(s.year())\n          }\n          return d.format('YYYY-MM-DD')\n        }\n      }\n    } catch (error) {\n      console.error(`Error parsing date \"${str}\": ${error.message}`);\n    }\n    return null; // Return null instead of throwing to allow processing to continue\n  }\n\n  // Helper function: Check if transaction buffer is complete\n  function isCompleteTransaction(buffer, cfg) {\n    // For Simplii, a complete transaction needs at least date and amounts\n    if (buffer.length < 4) {\n      console.log(`Buffer too short (${buffer.length} lines)`);\n      return false;\n    }\n\n    // More flexible patterns\n    const datePattern = /^[A-Za-z]{3} \d{1,2}$/;\n    const amountPattern = /^[+-]?[\\d,]+(\\.\\d{2})?$/;\n    \n    // Check dates - eff date is optional\n    const hasDate = datePattern.test(buffer[0].trim());\n    const hasEffDate = buffer[1] ? datePattern.test(buffer[1].trim()) : false;\n    \n    // Check amounts - look in last 3 positions\n    const fundsOutIdx = buffer.length - 3;\n    const fundsInIdx = buffer.length - 2;\n    const balanceIdx = buffer.length - 1;\n    \n    const hasFundsOut = fundsOutIdx >= 0 ? amountPattern.test(buffer[fundsOutIdx].trim()) : false;\n    const hasFundsIn = fundsInIdx >= 0 ? amountPattern.test(buffer[fundsInIdx].trim()) : false;\n    const hasBalance = balanceIdx >= 0 ? amountPattern.test(buffer[balanceIdx].trim()) : false;\n\n    console.log('Transaction completeness check:');\n    console.log(`- Date (${buffer[0]}): ${hasDate}`);\n    console.log(`- Eff Date (${buffer[1] || ''}): ${hasEffDate}`);\n    console.log(`- Funds Out (${buffer[fundsOutIdx] || ''}): ${hasFundsOut}`);\n    console.log(`- Funds In (${buffer[fundsInIdx] || ''}): ${hasFundsIn}`);\n    console.log(`- Balance (${buffer[balanceIdx] || ''}): ${hasBalance}`);\n\n    // Require date and at least one amount field\n    return hasDate && (hasFundsOut || hasFundsIn || hasBalance);\n  }\n\n  // Helper function: Process transaction buffer into transaction object\n  function processTxBuffer(buffer, cfg) {\n    const tx = {};\n    const datePattern = /^[A-Za-z]{3} \d{1,2}$/;\n\n    // Extract date from first line\n    tx.rawDate = buffer[0].trim();\n    \n    // Find where amounts start by scanning from end\n    let amountsStart = buffer.length - 1;\n    while (amountsStart >= 0 && !buffer[amountsStart].match(/^[+-]?[\\d,]+(\\.\\d{2})?$/)) {\n      amountsStart--;\n    }\n    \n    // We need at least 3 amount lines (funds out, funds in, balance)\n    if (buffer.length - amountsStart < 3) {\n      throw new Error('Invalid transaction format - missing amount fields');\n    }\n\n    // Extract amounts from last 3 numeric fields\n    tx.fundsOut = buffer[buffer.length-3].trim();\n    tx.fundsIn = buffer[buffer.length-2].trim();\n    tx.balance = buffer[buffer.length-1].trim();\n\n    // Effective date is optional - try to find it after the date\n    tx.rawEffDate = '';\n    if (buffer.length > 1 && datePattern.test(buffer[1].trim())) {\n      tx.rawEffDate = buffer[1].trim();\n    }\n\n    // Description is everything between date/effdate and amounts\n    const descStart = tx.rawEffDate ? 2 : 1;\n    const descEnd = buffer.length - 3;\n    tx.description = buffer.slice(descStart, descEnd).join(' ').trim();\n\n    // Check if it's an initial balance\n    tx.isInitial = tx.description.toUpperCase().includes('BALANCE FORWARD');\n\n    console.log('Processed transaction:', {\n      rawDate: tx.rawDate,\n      rawEffDate: tx.rawEffDate,\n      description: tx.description,\n      fundsOut: tx.fundsOut,\n      fundsIn: tx.fundsIn,\n      balance: tx.balance,\n      isInitial: tx.isInitial\n    });\n\n    return tx;\n  }\n\n  // Parse multi-line transactions using state machine\n  function parseMultiLineTransactions(text, cfg) {\n    console.log('Starting parseMultiLineTransactions');\n    console.log('Transaction section startRegex:', cfg.transactionSection.startRegex);\n    // Define state machine states\n    const WAITING_FOR_START = 'WAITING_FOR_START';\n    const PARSING_DESCRIPTION = 'PARSING_DESCRIPTION';\n    const PARSING_AMOUNTS = 'PARSING_AMOUNTS';\n\n    // Initialize state machine\n    let state = WAITING_FOR_START;\n    let headerSequenceStep = 0; // 0: looking for \"details\", 1: \"trans.\", 2: \"date\"\n    const lines = text.split(/\\r?\\n/);\n    const transactions = [];\n    let currentTxBuffer = [];\n\n    console.log(`Total lines to process: ${lines.length}`);\n\n    // Process each line\n    for (let i = 0; i < lines.length; i++) {\n      let line = lines[i].trim();\n\n      try {\n        console.log(`Processing line ${i+1}: \"${line}\" in state ${state}`);\n\n        // State transition logic\n        switch (state) {\n          case WAITING_FOR_START:\n            // Detect transaction start using regex pattern\n            console.log(`Checking line \"${line}\" against startRegex`);\n            const isMatch = cfg.transactionSection.startRegex.test(line);\n            console.log(`Match result: ${isMatch}`);\n            if (isMatch) {\n              console.log(`Transitioning from WAITING_FOR_START to PARSING_DESCRIPTION`);\n              // Initialize transaction buffer\n              currentTxBuffer = [];\n              // Transition to PARSING_DESCRIPTION state\n              state = PARSING_DESCRIPTION;\n            } else {\n              console.log(`Still in WAITING_FOR_START state`);\n            }\n            break;\n\n          case PARSING_DESCRIPTION:\n            // Check if line matches date pattern (indicating start of a new transaction)\n            const datePattern = /^[A-Za-z]{3} \d{1,2}$/;\n            if (datePattern.test(line)) {\n              console.log(`Found date line: \"${line}\"`);\n              \n              // If we have a previous transaction in the buffer, process it first\n              if (currentTxBuffer.length > 0) {\n                console.log(`Processing previous transaction buffer`);\n                if (isCompleteTransaction(currentTxBuffer, cfg)) {\n                  const tx = processTxBuffer(currentTxBuffer, cfg);\n                  transactions.push(tx);\n                  console.log(`Added transaction:`, tx);\n                } else {\n                  console.log(`Discarding incomplete transaction buffer`);\n                  console.log('Buffer contents:', currentTxBuffer);\n                }\n              }\n              \n              // Start new transaction with this date line\n              currentTxBuffer = [line];\n              console.log(`Started new transaction buffer with date`);\n              \n              // Transition to PARSING_AMOUNTS state\n              console.log(`Transitioning from PARSING_DESCRIPTION to PARSING_AMOUNTS`);\n              state = PARSING_AMOUNTS;\n            } else if (line.trim() === '') {\n              // Skip empty lines\n              console.log(`Skipping empty line in PARSING_DESCRIPTION state`);\n            } else {\n              // Add non-date, non-empty line to description\n              currentTxBuffer.push(line);\n              console.log(`Added description line: \"${line}\"`);\n              console.log(`Current buffer length: ${currentTxBuffer.length}`);\n            }\n            break;\n\n          case PARSING_AMOUNTS:\n            // More robust amount pattern that matches Simplii's format\n            const amountPattern = /^[+-]?[\\d,]+(\\.\\d{2})?$/;\n            \n            if (line.trim() === '') {\n              // Empty line might indicate end of transaction\n              console.log(`Found empty line in PARSING_AMOUNTS state`);\n              if (isCompleteTransaction(currentTxBuffer, cfg)) {\n                const tx = processTxBuffer(currentTxBuffer, cfg);\n                transactions.push(tx);\n                console.log(`Added completed transaction:`, tx);\n                currentTxBuffer = [];\n                state = WAITING_FOR_START;\n                console.log(`Transitioning to WAITING_FOR_START state`);\n              } else {\n                console.log(`Buffer not complete, keeping in PARSING_AMOUNTS state`);\n                console.log('Current buffer:', currentTxBuffer);\n              }\n            } else if (amountPattern.test(line)) {\n              console.log(`Found amount line: \"${line}\"`);\n              currentTxBuffer.push(line);\n              \n              // Check if we have a complete transaction\n              if (isCompleteTransaction(currentTxBuffer, cfg)) {\n                const tx = processTxBuffer(currentTxBuffer, cfg);\n                transactions.push(tx);\n                console.log(`Added completed transaction:`, tx);\n                currentTxBuffer = [];\n                state = WAITING_FOR_START;\n                console.log(`Transitioning to WAITING_FOR_START state`);\n              } else {\n                console.log(`Transaction needs more lines, staying in PARSING_AMOUNTS`);\n              }\n            } else {\n              // Non-amount line - could be part of description or new transaction\n              console.log(`Non-amount line in PARSING_AMOUNTS: \"${line}\"`);\n              if (isCompleteTransaction(currentTxBuffer, cfg)) {\n                // Process completed transaction first\n                const tx = processTxBuffer(currentTxBuffer, cfg);\n                transactions.push(tx);\n                console.log(`Added completed transaction:`, tx);\n                currentTxBuffer = [];\n              }\n              \n              // Check if this is a new transaction date line\n              const datePattern = /^[A-Za-z]{3} \d{1,2}$/;\n              if (datePattern.test(line)) {\n                console.log(`Found new transaction date line: \"${line}\"`);\n                currentTxBuffer = [line];\n                state = PARSING_DESCRIPTION;\n                console.log(`Transitioning to PARSING_DESCRIPTION state`);\n              } else {\n                // Add to current transaction as description\n                currentTxBuffer.push(line);\n                console.log(`Added line to transaction buffer`);\n              }\n            }\n            break;\n\n          default:\n            throw new Error(`Unknown state: ${state}`);\n        }\n      } catch (error) {\n        console.error(`Error in state ${state} on line ${i+1}: ${error.message}`);\n        // Handle error appropriately (e.g., skip line, reset state, etc.)\n      }\n    }\n\n    console.log(`Total transactions parsed: ${transactions.length}`);\n    return transactions;\n  }\n\n  // Parse chequing‐style (single‐line transactions, multi‐line desc)\n  function parseChequing(lines, cfg, metadata) {\n    if (cfg.transactionSection.multiLineTransaction) {\n      return parseMultiLineTransactions(lines.join('\\n'), cfg);\n    }\n\n    const txs = [];\n    const cs = cfg.transactionSection;\n    let inTx = false;\n\n    for (let line of lines) {\n      if (!inTx) {\n        if (cs.startRegex.test(line)) {\n          inTx = true;\n        }\n        continue;\n      }\n      if (cs.endRegex.test(line)) break;\n      if (cs.skipLineRegexes.some(r => r.test(line))) continue;\n\n      // initial balance (BALANCE FORWARD)\n      let m0 = line.match(cs.initialBalanceRegex);\n      if (m0) {\n        txs.push({\n          rawDate: m0[1],\n          rawEffDate: m0[2],\n          description: 'BALANCE FORWARD',\n          balance: m0[3],\n          isInitial: true\n        });\n        continue;\n      }\n\n      // normal transaction line\n      let m1 = line.match(cs.transactionLineRegex);\n      if (m1) {\n        txs.push({\n          rawDate: m1[1],\n          rawEffDate: m1[2],\n          description: m1[3].trim(),\n          fundsOut: m1[4],\n          fundsIn: m1[5],\n          balance: m1[6],\n          isInitial: false\n        });\n        continue;\n      }\n\n      // multi-line description append\n      if (cs.multiLineDescription) {\n        const last = txs[txs.length - 1];\n        if (last && !cs.headerRepeatRegex.test(line)) {\n          last.description += ' ' + line.trim();\n        }\n      }\n    }\n\n    return txs;\n  }\n\n  // Parse credit‐card‐style (fixed N-line blocks)\n  function parseCreditCard(lines, cfg, metadata) {\n    const cs = cfg.transactionSection;\n    const txs = [];\n    let inTx = false;\n    let buffer = [];\n\n    for (let line of lines) {\n      if (!inTx) {\n        if (cs.startRegex.test(line)) inTx = true;\n        continue;\n      }\n      if (cs.endRegex.test(line)) break;\n      if (cs.skipLineRegexes.some(r => r.test(line))) continue;\n\n      if (cs.recordSeparatorRegex.test(line)) {\n        // blank: flush buffer into a record\n        if (buffer.length) {\n          const rec = {};\n          for (let i = 0; i < cs.recordFields.length; i++) {\n            const {\n              name,\n              regex\n            } = cs.recordFields[i];\n            const m = buffer[i].match(regex);\n            if (!m) throw new Error(`Record parse failed on \"${buffer[i]}\"`);\n            rec[name] = m[1];\n          }\n          txs.push(rec);\n          buffer = [];\n        }\n        continue;\n      }\n      // data line\n      buffer.push(line.trim());\n    }\n    return txs;\n  }\n\n  // Post‐process both styles into unified transactions\n  function normalizeTransactions(rawTxs, cfg, metadata) {\n    const {\n      dateFormats\n    } = cfg;\n    const [periodStart, periodEnd] = metadata.period.split(/\\s*-\\s*/);\n    \n    // Filter out transactions with invalid dates before processing\n    const validTxs = rawTxs.filter(tx => {\n      tx.date = parseDate(tx.rawDate, dateFormats, periodStart, periodEnd);\n      if (!tx.date) {\n        console.error(`Skipping transaction with invalid date: ${tx.rawDate}`);\n        return false;\n      }\n      \n      // Effective date is optional\n      tx.effDate = parseDate(tx.rawEffDate, dateFormats, periodStart, periodEnd);\n      \n      return true;\n    });\n\n    // 1) parse balances & in/out into numbers\n    validTxs.forEach(tx => {\n      if (cfg.creditCard) {\n        tx.amount = parseFloat((tx.amount || '').replace(/,/g, '') || '0');\n        tx.type = tx.amount > 0 ? 'charge' : 'payment';\n        tx.balance = null; // might not be present\n      } else {\n        tx.balance = parseFloat((tx.balance || '').replace(/,/g, '') || '0');\n        tx.fundsIn = parseFloat((tx.fundsIn || '').replace(/,/g, '') || '0');\n        tx.fundsOut = parseFloat((tx.fundsOut || '').replace(/,/g, '') || '0');\n      }\n    });\n\n    // 2) for non-credit: compute signed amount & type via balance diff\n    if (!cfg.creditCard) {\n      for (let i = 1; i < validTxs.length; i++) {\n        const prev = validTxs[i - 1].balance;\n        const cur = validTxs[i].balance;\n        if (prev === undefined || cur === undefined) {\n          console.error('Skipping amount calculation due to missing balance');\n          continue;\n        }\n        const diff = +(cur - prev).toFixed(2);\n        validTxs[i].amount = diff;\n        validTxs[i].type = diff > 0 ? 'deposit' : 'withdrawal';\n      }\n    }\n    \n    console.log(`Successfully normalized ${validTxs.length}/${rawTxs.length} transactions`);\n    return validTxs;\n  }\n\n  // Top‐level\n  export async function parseStatement(text, configId) {\n    const cfg = await loadConfig(configId);\n    const lines = text.split(/\\r?\\n/);\n    const metadata = {};\n\n    // 1) extract metadata\n    //   for(let line of lines){\n    //     for(let p of cfg.metadataPatterns){\n    //       let m = line.match(p.regex)\n    //       if(m) metadata[p.field] = m.slice(1).join(' ')\n    //     }\n    //   }\n    // NEW - look for regexMark, then next non-empty line for regexValue\n    for (let i = 0; i < lines.length; i++) {\n      const line = lines[i];\n      for (const p of cfg.metadataPatterns) {\n        if (p.regexMark.test(line)) {\n          // find the next non-blank line\n          let j = i + 1;\n          while (j < lines.length && lines[j].trim() === '') j++;\n\n          const m = lines[j]?.match(p.regexValue);\n          if (m) {\n            // join captures in case your period has 2 capture groups\n            metadata[p.field] = m.slice(1).join(' ');\n          }\n          break; // we found this field's value, move to next metadata pattern\n        }\n      }\n    }\n\n    // 2) raw transactions\n    const rawTxs = cfg.creditCard ?\n      parseCreditCard(lines, cfg, metadata) :\n      parseChequing(lines, cfg, metadata);\n\n    // 3) normalize & compute\n    const transactions = normalizeTransactions(rawTxs, cfg, metadata);\n\n    return {\n      metadata,\n      transactions\n    };\n  }
=======
// parseStatement.js
  import fs from 'fs/promises'
  import dayjs from 'dayjs'
  import customParseFormat from 'dayjs/plugin/customParseFormat.js'
  dayjs.extend(customParseFormat)

  async function loadConfig(id) {
    //   return JSON.parse(
    //     await fs.readFile(new URL(`./configs/${id}.json`, import.meta.url), 'utf-8')
    //   )
    const mod = await import(new URL(`./configs/${id}.js`,
      import.meta.url))
    return mod.default
  }

  // Given “Dec 30” or “12/20/24” + formats + statement period,
  // return ISO “YYYY-MM-DD”.
  function parseDate(str, formats, periodStart, periodEnd) {
    try {
      for (let fmt of formats) {
        let d = dayjs(str, fmt, true)
        if (d.isValid()) {
          if (!fmt.includes('Y')) {
            // infer year: if month < start.month, use end.year, else start.year
            const s = dayjs(periodStart),
              e = dayjs(periodEnd)
            d = d.month() < s.month() ? d.year(e.year()) : d.year(s.year())
          }
          return d.format('YYYY-MM-DD')
        }
      }
    } catch (error) {
      console.error(`Error parsing date "${str}": ${error.message}`);
    }
    return null; // Return null instead of throwing to allow processing to continue
  }

  // Helper function: Check if transaction buffer is complete
  function isCompleteTransaction(buffer, cfg) {
    // For Simplii, a complete transaction needs at least date and amounts
    if (buffer.length < 4) {
      console.log(`Buffer too short (${buffer.length} lines)`);
      return false;
    }

    // More flexible patterns
    const datePattern = /^[A-Za-z]{3} \d{1,2}$/;
    const amountPattern = /^[+-]?[\d,]+(\.\d{2})?$/;
    
    // Check dates - eff date is optional
    const hasDate = datePattern.test(buffer[0].trim());
    const hasEffDate = buffer[1] ? datePattern.test(buffer[1].trim()) : false;
    
    // Check amounts - look in last 3 positions
    const fundsOutIdx = buffer.length - 3;
    const fundsInIdx = buffer.length - 2;
    const balanceIdx = buffer.length - 1;
    
    const hasFundsOut = fundsOutIdx >= 0 ? amountPattern.test(buffer[fundsOutIdx].trim()) : false;
    const hasFundsIn = fundsInIdx >= 0 ? amountPattern.test(buffer[fundsInIdx].trim()) : false;
    const hasBalance = balanceIdx >= 0 ? amountPattern.test(buffer[balanceIdx].trim()) : false;

    console.log('Transaction completeness check:');
    console.log(`- Date (${buffer[0]}): ${hasDate}`);
    console.log(`- Eff Date (${buffer[1] || ''}): ${hasEffDate}`);
    console.log(`- Funds Out (${buffer[fundsOutIdx] || ''}): ${hasFundsOut}`);
    console.log(`- Funds In (${buffer[fundsInIdx] || ''}): ${hasFundsIn}`);
    console.log(`- Balance (${buffer[balanceIdx] || ''}): ${hasBalance}`);

    // Require date and at least one amount field
    return hasDate && (hasFundsOut || hasFundsIn || hasBalance);
  }

  // Helper function: Process transaction buffer into transaction object
  function processTxBuffer(buffer, cfg) {
    const tx = {};
    const datePattern = /^[A-Za-z]{3} \d{1,2}$/;

    // Extract date from first line
    tx.rawDate = buffer[0].trim();
    
    // Find where amounts start by scanning from end
    let amountsStart = buffer.length - 1;
    while (amountsStart >= 0 && !buffer[amountsStart].match(/^[+-]?[\d,]+(\.\d{2})?$/)) {
      amountsStart--;
    }
    
    // We need at least 3 amount lines (funds out, funds in, balance)
    if (buffer.length - amountsStart < 3) {
      throw new Error('Invalid transaction format - missing amount fields');
    }

    // Extract amounts from last 3 numeric fields
    tx.fundsOut = buffer[buffer.length-3].trim();
    tx.fundsIn = buffer[buffer.length-2].trim();
    tx.balance = buffer[buffer.length-1].trim();

    // Effective date is optional - try to find it after the date
    tx.rawEffDate = '';
    if (buffer.length > 1 && datePattern.test(buffer[1].trim())) {
      tx.rawEffDate = buffer[1].trim();
    }

    // Description is everything between date/effdate and amounts
    const descStart = tx.rawEffDate ? 2 : 1;
    const descEnd = buffer.length - 3;
    tx.description = buffer.slice(descStart, descEnd).join(' ').trim();

    // Check if it's an initial balance
    tx.isInitial = tx.description.toUpperCase().includes('BALANCE FORWARD');

    console.log('Processed transaction:', {
      rawDate: tx.rawDate,
      rawEffDate: tx.rawEffDate,
      description: tx.description,
      fundsOut: tx.fundsOut,
      fundsIn: tx.fundsIn,
      balance: tx.balance,
      isInitial: tx.isInitial
    });

    return tx;
  }

  // Parse multi-line transactions using state machine
  function parseMultiLineTransactions(text, cfg) {
    console.log('Starting parseMultiLineTransactions');
    console.log('Transaction section startRegex:', cfg.transactionSection.startRegex);
    // Define state machine states
    const WAITING_FOR_START = 'WAITING_FOR_START';
    const PARSING_DESCRIPTION = 'PARSING_DESCRIPTION';
    const PARSING_AMOUNTS = 'PARSING_AMOUNTS';

    // Initialize state machine
    let state = WAITING_FOR_START;
    let headerSequenceStep = 0; // 0: looking for "details", 1: "trans.", 2: "date"
    const lines = text.split(/\r?\n/);
    const transactions = [];
    let currentTxBuffer = [];

    console.log(`Total lines to process: ${lines.length}`);

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      try {
        console.log(`Processing line ${i+1}: "${line}" in state ${state}`);

        // State transition logic
        switch (state) {
          case WAITING_FOR_START:
            // Detect transaction start using regex pattern
            console.log(`Checking line "${line}" against startRegex`);
            const isMatch = cfg.transactionSection.startRegex.test(line);
            console.log(`Match result: ${isMatch}`);
            if (isMatch) {
              console.log(`Transitioning from WAITING_FOR_START to PARSING_DESCRIPTION`);
              // Initialize transaction buffer
              currentTxBuffer = [];
              // Transition to PARSING_DESCRIPTION state
              state = PARSING_DESCRIPTION;
            } else {
              console.log(`Still in WAITING_FOR_START state`);
            }
            break;

          case PARSING_DESCRIPTION:
            // Check if line matches date pattern (indicating start of a new transaction)
            const datePattern = /^[A-Za-z]{3} \d{1,2}$/;
            if (datePattern.test(line)) {
              console.log(`Found date line: "${line}"`);
              
              // If we have a previous transaction in the buffer, process it first
              if (currentTxBuffer.length > 0) {
                console.log(`Processing previous transaction buffer`);
                if (isCompleteTransaction(currentTxBuffer, cfg)) {
                  const tx = processTxBuffer(currentTxBuffer, cfg);
                  transactions.push(tx);
                  console.log(`Added transaction:`, tx);
                } else {
                  console.log(`Discarding incomplete transaction buffer`);
                  console.log('Buffer contents:', currentTxBuffer);
                }
              }
              
              // Start new transaction with this date line
              currentTxBuffer = [line];
              console.log(`Started new transaction buffer with date`);
              
              // Transition to PARSING_AMOUNTS state
              console.log(`Transitioning from PARSING_DESCRIPTION to PARSING_AMOUNTS`);
              state = PARSING_AMOUNTS;
            } else if (line.trim() === '') {
              // Skip empty lines
              console.log(`Skipping empty line in PARSING_DESCRIPTION state`);
            } else {
              // Add non-date, non-empty line to description
              currentTxBuffer.push(line);
              console.log(`Added description line: "${line}"`);
              console.log(`Current buffer length: ${currentTxBuffer.length}`);
            }
            break;

          case PARSING_AMOUNTS:
            // More robust amount pattern that matches Simplii's format
            const amountPattern = /^[+-]?[\d,]+(\.\d{2})?$/;
            
            if (line.trim() === '') {
              // Empty line might indicate end of transaction
              console.log(`Found empty line in PARSING_AMOUNTS state`);
              if (isCompleteTransaction(currentTxBuffer, cfg)) {
                const tx = processTxBuffer(currentTxBuffer, cfg);
                transactions.push(tx);
                console.log(`Added completed transaction:`, tx);
                currentTxBuffer = [];
                state = WAITING_FOR_START;
                console.log(`Transitioning to WAITING_FOR_START state`);
              } else {
                console.log(`Buffer not complete, keeping in PARSING_AMOUNTS state`);
                console.log('Current buffer:', currentTxBuffer);
              }
            } else if (amountPattern.test(line)) {
              console.log(`Found amount line: "${line}"`);
              currentTxBuffer.push(line);
              
              // Check if we have a complete transaction
              if (isCompleteTransaction(currentTxBuffer, cfg)) {
                const tx = processTxBuffer(currentTxBuffer, cfg);
                transactions.push(tx);
                console.log(`Added completed transaction:`, tx);
                currentTxBuffer = [];
                state = WAITING_FOR_START;
                console.log(`Transitioning to WAITING_FOR_START state`);
              } else {
                console.log(`Transaction needs more lines, staying in PARSING_AMOUNTS`);
              }
            } else {
              // Non-amount line - could be part of description or new transaction
              console.log(`Non-amount line in PARSING_AMOUNTS: "${line}"`);
              if (isCompleteTransaction(currentTxBuffer, cfg)) {
                // Process completed transaction first
                const tx = processTxBuffer(currentTxBuffer, cfg);
                transactions.push(tx);
                console.log(`Added completed transaction:`, tx);
                currentTxBuffer = [];
              }
              
              // Check if this is a new transaction date line
              const datePattern = /^[A-Za-z]{3} \d{1,2}$/;
              if (datePattern.test(line)) {
                console.log(`Found new transaction date line: "${line}"`);
                currentTxBuffer = [line];
                state = PARSING_DESCRIPTION;
                console.log(`Transitioning to PARSING_DESCRIPTION state`);
              } else {
                // Add to current transaction as description
                currentTxBuffer.push(line);
                console.log(`Added line to transaction buffer`);
              }
            }
            break;

          default:
            throw new Error(`Unknown state: ${state}`);
        }
      } catch (error) {
        console.error(`Error in state ${state} on line ${i+1}: ${error.message}`);
        // Handle error appropriately (e.g., skip line, reset state, etc.)
      }
    }

    console.log(`Total transactions parsed: ${transactions.length}`);
    return transactions;
  }

  // Parse chequing‐style (single‐line transactions, multi‐line desc)
  function parseChequing(lines, cfg, metadata) {
    if (cfg.transactionSection.multiLineTransaction) {
      return parseMultiLineTransactions(lines.join('\n'), cfg);
    }

    const txs = [];
    const cs = cfg.transactionSection;
    let inTx = false;

    for (let line of lines) {
      if (!inTx) {
        if (cs.startRegex.test(line)) {
          inTx = true;
        }
        continue;
      }
      if (cs.endRegex.test(line)) break;
      if (cs.skipLineRegexes.some(r => r.test(line))) continue;

      // initial balance (BALANCE FORWARD)
      let m0 = line.match(cs.initialBalanceRegex);
      if (m0) {
        txs.push({
          rawDate: m0[1],
          rawEffDate: m0[2],
          description: 'BALANCE FORWARD',
          balance: m0[3],
          isInitial: true
        });
        continue;
      }

      // normal transaction line
      let m1 = line.match(cs.transactionLineRegex);
      if (m1) {
        txs.push({
          rawDate: m1[1],
          rawEffDate: m1[2],
          description: m1[3].trim(),
          fundsOut: m1[4],
          fundsIn: m1[5],
          balance: m1[6],
          isInitial: false
        });
        continue;
      }

      // multi-line description append
      if (cs.multiLineDescription) {
        const last = txs[txs.length - 1];
        if (last && !cs.headerRepeatRegex.test(line)) {
          last.description += ' ' + line.trim();
        }
      }
    }

    return txs;
  }

  // Parse credit‐card‐style (fixed N-line blocks)
  function parseCreditCard(lines, cfg, metadata) {
    const cs = cfg.transactionSection;
    const txs = [];
    let inTx = false;
    let buffer = [];

    for (let line of lines) {
      if (!inTx) {
        if (cs.startRegex.test(line)) inTx = true;
        continue;
      }
      if (cs.endRegex.test(line)) break;
      if (cs.skipLineRegexes.some(r => r.test(line))) continue;

      if (cs.recordSeparatorRegex.test(line)) {
        // blank: flush buffer into a record
        if (buffer.length) {
          const rec = {};
          for (let i = 0; i < cs.recordFields.length; i++) {
            const {
              name,
              regex
            } = cs.recordFields[i];
            const m = buffer[i].match(regex);
            if (!m) throw new Error(`Record parse failed on "${buffer[i]}"`);
            rec[name] = m[1];
          }
          txs.push(rec);
          buffer = [];
        }
        continue;
      }
      // data line
      buffer.push(line.trim());
    }
    return txs;
  }

  // Post‐process both styles into unified transactions
  function normalizeTransactions(rawTxs, cfg, metadata) {
    const {
      dateFormats
    } = cfg;
    const [periodStart, periodEnd] = metadata.period.split(/\s*-\s*/);
    
    // Filter out transactions with invalid dates before processing
    const validTxs = rawTxs.filter(tx => {
      tx.date = parseDate(tx.rawDate, dateFormats, periodStart, periodEnd);
      if (!tx.date) {
        console.error(`Skipping transaction with invalid date: ${tx.rawDate}`);
        return false;
      }
      
      // Effective date is optional
      tx.effDate = parseDate(tx.rawEffDate, dateFormats, periodStart, periodEnd);
      
      return true;
    });

    // 1) parse balances & in/out into numbers
    validTxs.forEach(tx => {
      if (cfg.creditCard) {
        tx.amount = parseFloat((tx.amount || '').replace(/,/g, '') || '0');
        tx.type = tx.amount > 0 ? 'charge' : 'payment';
        tx.balance = null; // might not be present
      } else {
        tx.balance = parseFloat((tx.balance || '').replace(/,/g, '') || '0');
        tx.fundsIn = parseFloat((tx.fundsIn || '').replace(/,/g, '') || '0');
        tx.fundsOut = parseFloat((tx.fundsOut || '').replace(/,/g, '') || '0');
      }
    });

    // 2) for non-credit: compute signed amount & type via balance diff
    if (!cfg.creditCard) {
      for (let i = 1; i < validTxs.length; i++) {
        const prev = validTxs[i - 1].balance;
        const cur = validTxs[i].balance;
        if (prev === undefined || cur === undefined) {
          console.error('Skipping amount calculation due to missing balance');
          continue;
        }
        const diff = +(cur - prev).toFixed(2);
        validTxs[i].amount = diff;
        validTxs[i].type = diff > 0 ? 'deposit' : 'withdrawal';
      }
    }
    
    console.log(`Successfully normalized ${validTxs.length}/${rawTxs.length} transactions`);
    return validTxs;
  }

  // Top‐level
  export async function parseStatement(text, configId) {
    const cfg = await loadConfig(configId);
    const lines = text.split(/\r?\n/);
    const metadata = {};

    // 1) extract metadata
    //   for(let line of lines){
    //     for(let p of cfg.metadataPatterns){
    //       let m = line.match(p.regex)
    //       if(m) metadata[p.field] = m.slice(1).join(' ')
    //     }
    //   }
    // NEW - look for regexMark, then next non-empty line for regexValue
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const p of cfg.metadataPatterns) {
        if (p.regexMark.test(line)) {
          // find the next non-blank line
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;

          const m = lines[j]?.match(p.regexValue);
          if (m) {
            // join captures in case your period has 2 capture groups
            metadata[p.field] = m.slice(1).join(' ');
          }
          break; // we found this field's value, move to next metadata pattern
        }
      }
    }

    // 2) raw transactions
    const rawTxs = cfg.creditCard ?
      parseCreditCard(lines, cfg, metadata) :
      parseChequing(lines, cfg, metadata);

    // 3) normalize & compute
    const transactions = normalizeTransactions(rawTxs, cfg, metadata);

    return {
      metadata,
      transactions
    };
  }
>>>>>>> 49e1f93 (feat: Add multi-line transaction parsing for Simplii Financial)
