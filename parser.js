
// Set env DEV_STATEMENT_PDF_FILE to use as first pdf to parse
/*
	1. Load pdf from file
	2. Identify metadata and store it
		- Make sure associated account is specified : name or number
			- Can't use number b/c cc number can change
			- How do you asssociate this with gnucash acc naming? - TBD
	3. Identify Transactions
		- Parse
		- Store
	4. handle pagenation
	5. Edge cases
		- Opening Balance
		- no transactions ?
		- ... tbd
	6. Create CSV
		- Add metadata
		- Generate headder row
		- Populate transactions
*/

/* parsing library : 
const text = await pdfToText(file);
console.log(text);
*/

/* parsing libarary: 
const  text2 = await readPdfText({url: `download_dir/${pdfFile}`})
console.log(text2)
*/

/* pdf-parse - spaces are removed within incoming text - maybe easier to use PDF.js (mozilla) directly
pdf(file).then((data) =>{
	console.log(data)
}).catch((err) =>{
	console.error(err)
})
*/

import * as path from "node:path";
import {
	fileURLToPath
} from "node:url";
import * as fs from "node:fs"
// import pdf from "pdf-parse/lib/pdf-parse.js"
// import {pdfToText} from "pdf-ts"
// import {readPdfText} from "pdf-text-reader"
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"
import "dotenv/config";
import * as utils from "./utils.js"

const __dirname =
	path.dirname(fileURLToPath(
		import.meta.url))

const inputDir = path.resolve(__dirname, "download_dir") //  TODO Update this to envar
const outputDir = path.resolve(__dirname, "download_dir", "csv") //  TODO Update this to envar
const pdfFile = process.env.DEV_STATEMENT_PDF_FILE
const pdfFilePath = `download_dir/${pdfFile}`
console.log(pdfFile)

utils.ensurePathExists(outputDir)

// 1. Load pdf from file
const file = fs.readFileSync(pdfFilePath);
console.log(file)

const loadingTask = pdfjs.getDocument(pdfFilePath)
loadingTask.promise.then((doc)=>{
	console.log(doc)
})
// const loadResults = await loadingTask.promise
// console.log(loadResults)
// const documentTask = getDocument(file)
// const document = await documentTask.promise
// console.log(document)