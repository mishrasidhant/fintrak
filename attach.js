import puppeteer from "puppeteer";
import {
	writeFile,
	existsSync,
	mkdirSync,
	writeFileSync,
	renameSync
} from "node:fs";
import {
	fileURLToPath
} from "node:url";
import * as path from "node:path";
import "dotenv/config";

const __filename = fileURLToPath(
	import.meta.url)
const __dirname =
	path.dirname(fileURLToPath(
		import.meta.url))

const browserWSEndpoint = process.argv[2];
const downloadDir = path.resolve(__dirname, "download_dir") //  Update this to envar

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function debugFile(file, content) {
	writeFile(file, content, "utf8", (err) => {
		if (err) throw err;
		console.log(`Successfully wrote file :${file}`);
	});
}

function checkDownloadPath(downloadDir) {
	if (!existsSync(downloadDir)) {
		mkdirSync(downloadDir)
	}
}

const connectToPages = (async (browserWSEndpoint, cleanup) => {
	checkDownloadPath(downloadDir)
	console.log(browserWSEndpoint);
	const browser = await puppeteer.connect({
		browserWSEndpoint: browserWSEndpoint,
		defaultViewport: {
			width: 1280,
			height: 999,
		},
	});

	const pages = await browser.pages();
	// console.log(
	// 	"Open pages: ",
	// 	pages.map((p) => p.url())
	// );

	// Filter simplii page and navigate to login page
	const simpliiPage = pages.filter((p) =>
		p.url().includes(process.env.SIMPLII_URL_INCLUDES)
	);
	const page = simpliiPage[0];

	// Redirect Chrome's download manager
	const downloadSession = await browser.target().createCDPSession();
	await downloadSession.send('Browser.setDownloadBehavior', {
		behavior: 'allow',
		downloadPath: downloadDir,
		eventsEnabled: true,
	})
	// holds { downloadId, suggestedFilename}
	let downloadCtx = {};
	downloadSession.on('Browser.downloadWillBegin', (event) => {
		console.log(`⚡ download will begin → ${event}`);
		downloadCtx.downloadId = event.downloadId;
		downloadCtx.suggestedFilename = event.suggestedFilename;
	})
	// await this in downloadStatement before renaming
	downloadSession.on('Browser.downloadProgress', (event) => {
		if (event.state === 'completed' && event.downloadId === downloadCtx.downloadId) {
			console.log(`⚡ download completed → ${event}`);
			const oldPath = path.join(downloadDir, downloadCtx.suggestedFilename)
			const newName = `${downloadCtx.bank}_${downloadCtx.formattedAccount}_${downloadCtx.year}_${downloadCtx.month}_statement.pdf}`
			const newPath = path.join(downloadDir, newName);
			renameSync(oldPath, newPath);
			console.log(`✅ download complete -> renamed to ${newName}`)
		}
	})

	/*
	// Puppetere page response iterception couldn't handle pdf download
	// Using CDP Fetch Domain
	const client = await page.createCDPSession();
	await client.send('Fetch.enable', {
		patterns: [{
			// urlPattern: 'online.simplii.com',
			urlPattern: '*',
			requestStage: 'Response',
		}] // Use * to catch all
	});
	*/

	// Set download behavior on browser
	// await page._client().send('Page.setDownloadBehavior', {
	// 	behavior: 'deny'
	// })

	const homeLink = await page.locator("a ::-p-text(Home)");
	await homeLink.click();
	await page.waitForNetworkIdle();

	/* Navigate to estatements page */
	const statementLink = await page.locator(
		'[data-test-id="olb-extras-view-estatements"]'
	);
	await statementLink.scroll();
	await statementLink.click();
	await page.waitForNetworkIdle();

	/*
	// THIS WORKS!! -> but promise.All is more performant -> although I like the readability here
	const options = await page.$$('#ember1247-field option');
	console.log(`found ${options.length} options`)

	for (const option of options){
		const value = await option.evaluate(el => el.value)
		const text = await option.evaluate(el => el.textContent.trim())
		const text2 = await option.evaluate(el => el.text)
		optionsList.push({value, text, text2});
	}

	console.log(optionsList)
*/

	/* Get acc list */
	const accList = await page.$$eval(
		"div.online-statements div.account-selector-section ui-select select option",
		async (opts) =>
			Promise.all(
				// Get all accounts
				opts.map(async (opt) => ({
					selectValue: opt.value,
					text: opt.textContent.trim(),
				}))
			)
	);

	/* Filter acc list and add account numbers */
	const cfgAccList = process.env.SIMPLII_ACC_LIST.split(",");
	const filteredAccList = accList
		.filter((acc) => cfgAccList.some((cfgAcc) => acc.text.includes(cfgAcc)))
		.map((acc) => {
			const account = cfgAccList.find((cfgAcc) => acc.text.includes(cfgAcc));
			const formattedAccount = account.split(" ").join("-");
			return {
				...acc,
				account,
				formattedAccount
			};
		});
	// console.log('filteredAccList: ', filteredAccList);

	const startYear = parseInt(process.env.SIMPLII_START_YEAR || "2018", 10);
	const endYear = new Date().getFullYear();
	const validYears = Array.from({
			length: endYear - startYear + 1
		}, (_, i) =>
		(startYear + i).toString()
	);

	/* Act on individual Accounts */
	const bankData = [];
	const getAccountData = async function (acc) {
		await page.select(
			"div.online-statements div.account-selector-section ui-select select",
			`${acc.selectValue}`
		);
		await page.waitForNetworkIdle();
		const accData = await page.$$eval(
			'span[role="button"]',
			(accSpans, validYears, account, formattedAccount, selectValue) => {
				return accSpans
					.filter((span) =>
						validYears.some((year) => span.innerText.includes(year))
					)
					.map((span) => {
						const spanText = span.innerText.trim();
						const year = validYears.find((validYear) =>
							spanText.includes(validYear)
						);
						return {
							spanId: span.getAttribute("id") || null,
							selectValue,
							year: year || null,
							text: spanText,
							account: account,
							formattedAccount: formattedAccount,
							bank: 'simplii',
						};
					});
			},
			validYears,
			acc.account,
			acc.formattedAccount,
			acc.selectValue
		);
		return accData;
	};
	// TODO Document
	const getStatementList = async function (acc) {
		for (const yearData of acc) {
			const span = await page.$(`#${yearData.spanId}`);
			const spanParentDiv = await span.evaluateHandle(
				(span) => span.parentElement
			);
			const parentDivContent = await spanParentDiv.evaluateHandle(
				(div) => div.nextElementSibling
			);
			const ul = await parentDivContent.$("ul.monthly-statements");
			const liList = await ul.$$("li");

			const buttonsData = [];
			for (const li of liList) {
				const uiButton = await li.$("ui-button");
				if (!uiButton) continue;

				const uiButtonId = await uiButton.evaluate((el) =>
					el.getAttribute("id")
				);
				const uiButtonAriaLabel = await uiButton.evaluate((el) =>
					el.getAttribute("aria-label")
				);

				const buttonHandle = await uiButton.$("button");
				const buttonText = buttonHandle ?
					await buttonHandle.evaluate((el) => el.textContent.trim()) :
					"";

				buttonsData.push({
					clickableId: uiButtonId,
					ariaLabel: uiButtonAriaLabel,
					buttonText,
					month: buttonText.split(" ")[0] || ""
				});
			}
			yearData.statementData = buttonsData;
		}
	};
	const downloadStatement = async function (opts) {
		const {
			year,
			formattedAccount,
			bank
		} = opts
		for (const buttonData of opts.statementData) {
			const {
				month,
				clickableId
			} = buttonData
			downloadCtx = {
				bank,
				formattedAccount,
				year,
				month
			};
			const randomMs = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000
			await delay(randomMs)
			console.log('Delaying for : ', Math.floor(randomMs / 1000), ' seconds')

			// await on CDP downloadProgress event
			const done = new Promise(resolve => {
				downloadSession.once('Browser.downloadProgress', ({
					downloadId,
					state
				}) => {
					if (state === 'completed' && downloadId === downloadCtx.downloadId) {
						return resolve();
					}
				})
			})

			// Build a promise that will resolve for "this" PDF download - one-shot handler
			/*
			const pdfPromise = new Promise((resolve, reject) => {
				const onRequestPaused = async (event) => {
					try {
						console.log(`Fetch request paused, event received: ${event}`)
						const contentTypeHeader = event.responseHeaders.find(h => h.name.toLowerCase() === "content-type")?.value || "";

						if (event.responseStatusCode && contentTypeHeader.includes("application/pdf")) {
							console.log("!Content Type match to PDF!")
							// Get request body
							const {
								body,
								base64Encoded
							} = await client.send("Fetch.getResponseBody", {
								requestId: event.requestId
							})

							// Unblock browser
							await client.send("Fetch.continueRequest", {
								requestId: event.requestId
							})

							// Cleanup this listener
							client.off("Fetch.requestPaused", onRequestPaused);

							const pdfBuffer = base64Encoded ?
								Buffer.from(body, "base64") :
								Buffer.from(body)
							resolve({
								pdfBuffer,
								bank,
								formattedAccount,
								year,
								month
							});
						} else {
							console.log(`Event not a match : ${event}`)
							await client.send("Fetch.continueRequest", {
								requestId: event.requestId
							})
						}
					} catch (err) {
						console.error(err)
						reject(err)
					}
				};
				// Install the one-shot handler
				client.on("Fetch.requestPaused", onRequestPaused)
			})
			*/

			// Register handler to intercept and create PDF record
			/*
			client.on('Fetch.requestPaused', async (event) => {
				debugger;
				console.log(`Fetch request paused, event received: ${event}`)
				if (event.responseStatusCode && event.responseHeaders) {
					const contentTypeHeader = event.responseHeaders.find(
						(h) => h.name.toLowerCase() === 'content-type'
					);
					if (contentTypeHeader && contentTypeHeader.value.includes('application/pdf')) {
						console.log("!Content Type match to PDF!")
						const responseBody = await client.send('Fetch.getResponseBody', {
							requestId: event.requestId,
						})
						const pdfData = responseBody.base64Encoded ?
							Buffer.from(responseBody.body, 'base64') :
							Buffer.from(responseBody.body)

						const fileName = `${bank}_${formattedAccount}_${year}_${month}_statement.pdf`
						const filePath = path.join(downloadDir, fileName);
						writeFileSync(filePath, pdfData);
						console.log(`Saved intercepted PDF: ${filePath}`)

						await client.send('Fetch.continueRequest', {
							requestId: event.requestId
						})
						return;
					}
				}
				console.log(`NO MATCH for request with event: ${event}`)
				await client.send('Fetch.continueRequest', {
					requestId: event.requestId
				})
			})
			*/
			/*
						// Enable logging to check if puppeteer gets response - This does not intercept anything - instead line 247 errors out first
						page.on('response', (res) =>{
							const contentType = res.headers()['content-type'] || '';
							const requestMethod = res.request().method()
							console.log('Response URL: ', res.url(), ' | Content Type: ', contentType, ' | request type: ', requestMethod);
						})
						const pdfResponse = page.waitForResponse(res => {
							const contentType = res.headers()['content-type'] || '';
							console.log('Response URL: ', res.url(), ' | Content Type: ', contentType);
							return contentType.includes('application/pdf') && res.request().method() === 'POST';
						});
			*/

			// Trigger the download
			await page.waitForSelector(`#${clickableId}`, {
				visible: true
			})
			console.log(`Attempting to click button with ID:  ${clickableId}`)
			await page.click(`#${clickableId}`)

			await done; // now the file's on disk and already

			/*
			const {
				pdfBuffer,
				bank: b,
				formattedAccount: fa,
				year: y,
				month: m
			} = await pdfPromise;
			*/
			// const fileName = `${b}_${fa}_${y}_${m}_statement.pdf`
			// const filePath = path.join(downloadDir, fileName);
			// writeFileSync(filePath, pdfBuffer);
			// console.log(`Saved PDF: ${filePath}`)

			/*
						const pdfBuffer = await pdfResponse.buffer();
						const fileName = `${bank}_${formattedAccount}_${year}_${month}_statement.pdf`
						const filePath = path.join(downloadDir, fileName);
						writeFileSync(filePath, pdfBuffer);
						console.log(`Saved PDF: ${filePath}`)
			*/
		}
	}
	const processAll = async function (accData) {
		for (const yearData of accData) {
			await downloadStatement({
				...yearData,
			})
		}
	}
	for (const acc of filteredAccList) {
		const accData = await getAccountData(acc);
		// Process account specific data here!
		await getStatementList(accData);
		// console.log('accData from getAccountData: ', accData);
		await processAll(accData)
		// Process each account's statements here
		//  await processAccount(accData)
		bankData.push(accData);
	}
	await browser.disconnect();
})(browserWSEndpoint, () => {
	console.log("cleanup invoked)");
});

await connectToPages;