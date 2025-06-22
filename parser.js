
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
import * as fs from "node:fs/promises"
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"
import "dotenv/config";
import * as utils from "./utils.js"

const __dirname =
	path.dirname(fileURLToPath(
		import.meta.url))

const pdfFileDir = path.resolve(__dirname, "download_dir", "sample") //  TODO Update this to envar
const csvFileDir = path.resolve(__dirname, "download_dir", "csv") //  TODO Update this to envar
const txtFileDir = path.resolve(__dirname, "download_dir", "txt") //  TODO Update this to envar
const pdfFileName = process.env.DEV_STATEMENT_PDF_FILE
const pdfFilePath = path.resolve(pdfFileDir, pdfFileName) 
// Create a .txt filename for the current 
const txtFilePath = path.format({
	dir: txtFileDir,
	name: path.basename(pdfFileName, path.extname(pdfFileName)),
	ext: '.txt'
})
const csvFilePath = path.format({
	dir: csvFileDir,
	name: path.basename(pdfFileName, path.extname(pdfFileName)),
	ext: '.csv'
})
console.log({
	pdfFileDir,
	pdfFileName,
	pdfFilePath,
	csvFileDir,
	csvFilePath,
	txtFileDir,
	txtFilePath
})

utils.ensurePathExists(csvFileDir)
utils.ensurePathExists(txtFileDir)

// 1. Load pdf from file - not required
// const pdfFileBuffer = await fs.readFile(pdfFilePath)
// console.log(pdfFileBuffer)

const loadingTask = await pdfjs.getDocument(pdfFilePath).promise
const pagesPromise = []
for (let i = 1; i <= loadingTask.numPages; i++) {
	pagesPromise.push(loadingTask.getPage(i))
}
const pages = await Promise.all(pagesPromise)
const pagesTextContentPromise = []
for (let i = 0; i < pages.length; i++) {
	pagesTextContentPromise.push(pages[i].getTextContent())
}
const pagesTextContent = await Promise.all(pagesTextContentPromise)
let stringContent = ''
pagesTextContent.forEach(page => {
	stringContent += page.items.map(i => i.str).join("\n")
});
await fs.writeFile(txtFilePath, stringContent)
console.log(`>> ${stringContent}`)
/*
const loadingTask = pdfjs.getDocument(pdfFilePath);
loadingTask.promise
  .then(function (doc) {
    const numPages = doc.numPages;
    console.log("# Document Loaded");
    console.log("Number of Pages: " + numPages);
    console.log();

    let lastPromise; // will be used to chain promises
    lastPromise = doc.getMetadata().then(function (data) {
      console.log("# Metadata Is Loaded");
      console.log("## Info");
      console.log(JSON.stringify(data.info, null, 2));
      console.log();
      if (data.metadata) {
        console.log("## Metadata");
        console.log(JSON.stringify(data.metadata.getAll(), null, 2));
        console.log();
      }
    });

    const loadPage = function (pageNum) {
      return doc.getPage(pageNum).then(function (page) {
        console.log("# Page " + pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        console.log("Size: " + viewport.width + "x" + viewport.height);
        console.log();
        return page
          .getTextContent()
          .then(function (content) {
            // Content contains lots of information about the text layout and
            // styles, but we need only strings at the moment
            const strings = content.items.map(function (item) {
              return item.str;
            });
            console.log("## Text Content");
            console.log(strings.join(" "));
            // Release page resources.
            page.cleanup();
          })
          .then(function () {
            console.log();
          });
      });
    };
    // Loading of the first page will wait on metadata and subsequent loadings
    // will wait on the previous pages.
    for (let i = 1; i <= numPages; i++) {
      lastPromise = lastPromise.then(loadPage.bind(null, i));
    }
    return lastPromise;
  })
  .then(
    function () {
      console.log("# End of Document");
    },
    function (err) {
      console.error("Error: " + err);
    }
  );
*/

// const loadResults = await loadingTask.promise
// console.log(loadResults)
// const documentTask = getDocument(file)
// const document = await documentTask.promise
// console.log(document)

/* Parsing text -> patterns and associated values that come in next */
// statement period: 	->		April 30, 2025 - May 28, 2025
// statement date: 		->		May 28, 2025
// account number:		->		<NUMBER>
/* Parsing text -> pattern to signal beginning of transactions
details

trans.

date

eff.

date

transaction
 
funds out
 
funds in
 
balance

Apr 30
 
Apr 30
 
BALANCE FORWARD
 
6,858.04
*/