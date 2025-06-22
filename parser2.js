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
	throw new Error(`Unrecognized date "${str}"`)
}

// Parse chequing‐style (single‐line transactions, multi‐line desc)
function parseChequing(lines, cfg, metadata) {
	const txs = []
	const cs = cfg.transactionSection
	let inTx = false

	for (let line of lines) {
		if (!inTx) {
			if (cs.startRegex.test(line)) {
				inTx = true
			}
			continue
		}
		if (cs.endRegex.test(line)) break
		if (cs.skipLineRegexes.some(r => r.test(line))) continue

		// initial balance (BALANCE FORWARD)
		let m0 = line.match(cs.initialBalanceRegex)
		if (m0) {
			txs.push({
				rawDate: m0[1],
				rawEffDate: m0[2],
				description: 'BALANCE FORWARD',
				balance: m0[3],
				isInitial: true
			})
			continue
		}

		// normal transaction line
		let m1 = line.match(cs.transactionLineRegex)
		if (m1) {
			txs.push({
				rawDate: m1[1],
				rawEffDate: m1[2],
				description: m1[3].trim(),
				fundsOut: m1[4],
				fundsIn: m1[5],
				balance: m1[6],
				isInitial: false
			})
			continue
		}

		// multi-line description append
		if (cs.multiLineDescription) {
			const last = txs[txs.length - 1]
			if (last && !cs.headerRepeatRegex.test(line)) {
				last.description += ' ' + line.trim()
			}
		}
	}

	return txs
}

// Parse credit‐card‐style (fixed N-line blocks)
function parseCreditCard(lines, cfg, metadata) {
	const cs = cfg.transactionSection
	const txs = []
	let inTx = false
	let buffer = []

	for (let line of lines) {
		if (!inTx) {
			if (cs.startRegex.test(line)) inTx = true
			continue
		}
		if (cs.endRegex.test(line)) break
		if (cs.skipLineRegexes.some(r => r.test(line))) continue

		if (cs.recordSeparatorRegex.test(line)) {
			// blank: flush buffer into a record
			if (buffer.length) {
				const rec = {}
				for (let i = 0; i < cs.recordFields.length; i++) {
					const {
						name,
						regex
					} = cs.recordFields[i]
					const m = buffer[i].match(regex)
					if (!m) throw new Error(`Record parse failed on "${buffer[i]}"`)
					rec[name] = m[1]
				}
				txs.push(rec)
				buffer = []
			}
			continue
		}
		// data line
		buffer.push(line.trim())
	}
	return txs
}

// Post‐process both styles into unified transactions
function normalizeTransactions(rawTxs, cfg, metadata) {
	const {
		dateFormats
	} = cfg
	const [periodStart, periodEnd] = metadata.period.split(/\s*-\s*/)
	// 1) parse dates & balances
	rawTxs.forEach(tx => {
		tx.date = parseDate(tx.rawDate, dateFormats, periodStart, periodEnd)
		tx.effDate = parseDate(tx.rawEffDate, dateFormats, periodStart, periodEnd)
		// parse balances & in/out into numbers
		if (cfg.creditCard) {
			tx.amount = parseFloat(tx.amount.replace(/,/g, ''))
			tx.type = tx.amount > 0 ? 'charge' : 'payment'
			tx.balance = null // might not be present
		} else {
			tx.balance = parseFloat(tx.balance.replace(/,/g, ''))
			tx.fundsIn = parseFloat(tx.fundsIn.replace(/,/g, '') || '0')
			tx.fundsOut = parseFloat(tx.fundsOut.replace(/,/g, '') || '0')
		}
	})

	// 2) for non-credit: compute signed amount & type via balance diff
	if (!cfg.creditCard) {
		for (let i = 1; i < rawTxs.length; i++) {
			const prev = rawTxs[i - 1].balance
			const cur = rawTxs[i].balance
			const diff = +(cur - prev).toFixed(2)
			rawTxs[i].amount = diff
			rawTxs[i].type = diff > 0 ? 'deposit' : 'withdrawal'
		}
	}
	return rawTxs
}

// Top‐level
export async function parseStatement(text, configId) {
	const cfg = await loadConfig(configId)
	const lines = text.split(/\r?\n/)
	const metadata = {}

	// 1) extract metadata
	//   for(let line of lines){
	//     for(let p of cfg.metadataPatterns){
	//       let m = line.match(p.regex)
	//       if(m) metadata[p.field] = m.slice(1).join(' ')
	//     }
	//   }
	// NEW - look for regexMark, then next non-empty line for regexValue
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		for (const p of cfg.metadataPatterns) {
			if (p.regexMark.test(line)) {
				// find the next non-blank line
				let j = i + 1
				while (j < lines.length && lines[j].trim() === '') j++

				const m = lines[j]?.match(p.regexValue)
				if (m) {
					// join captures in case your period has 2 capture groups
					metadata[p.field] = m.slice(1).join(' ')
				}
				break // we found this field’s value, move to next metadata pattern
			}
		}
	}


	// 2) raw transactions
	const rawTxs = cfg.creditCard ?
		parseCreditCard(lines, cfg, metadata) :
		parseChequing(lines, cfg, metadata)

	// 3) normalize & compute
	const transactions = normalizeTransactions(rawTxs, cfg, metadata)

	return {
		metadata,
		transactions
	}
}