// parseStatement.js
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
