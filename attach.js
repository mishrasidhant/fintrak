import puppeteer from "puppeteer";
import {
	existsSync,
	mkdirSync,
	renameSync
} from "node:fs";
import {
	fileURLToPath
} from "node:url";
import * as path from "node:path";
import "dotenv/config";

const __dirname =
	path.dirname(fileURLToPath(
		import.meta.url))

const browserWSEndpoint = process.argv[2];
const downloadDir = path.resolve(__dirname, "download_dir") //  TODO Update this to envar

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkDownloadPath(downloadDir) {
	if (!existsSync(downloadDir)) {
		mkdirSync(downloadDir)
	}
}

function informErrors(bankData) {
	for (const acc of bankData) {
		for (const yearData of acc) {
			const failures = yearData.statementData.filter(stmt => stmt.error);
			if (failures.length) {
				const account = yearData.formattedAccount
				const year = yearData.year
				console.warn(`Account ${account} - Year ${year} hadd ${failures.length} failures`)
				const monthlyFailures = failures.map(f => ({
					month: f.month,
					error: f.error,
				}))
				monthlyFailures.forEach(f => {
					const serialErr = JSON.stringify(f.error)
					console.warn(`Month: ${f.month} - Error: ${serialErr}`)
				});
			}
		}
	}
}

const connectToPages = (async (browserWSEndpoint, cleanup) => {
	const cfgAccList = process.env.SIMPLII_ACC_LIST.split(",");
	const startYear = parseInt(process.env.SIMPLII_START_YEAR || "2018", 10);
	const endYear = new Date().getFullYear();
	const validYears = Array.from({
			length: endYear - startYear + 1
		}, (_, i) =>
		(startYear + i).toString()
	);
	const bankData = [];

	/* Add every available Year for a specific account*/
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
							// Tracks visibliity status ('true' | 'false') of span
							spanVisible: span.getAttribute("aria-expanded"),
							selectValue,
							year: year || null,
							text: spanText,
							account: account,
							formattedAccount: formattedAccount,
							// TODO make this dynamic when adding support for other banks
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
	/* Click on span (Year) elements that aren't visible */
	const makeAllYearsVisible = async function (accData) {
		for (const acc of accData) {
			if (acc.spanVisible === 'false') {
				await page.click(`#${acc.spanId}`)
			}
		}
	}
	/* Add a list of buttons that match a monthly statement download (belongs to Year within Account) */
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
	/* Download all statements for a specified Year */
	const downloadStatements = async function ({
		year,
		formattedAccount,
		bank,
		statementData
	}) {
		for (const stmt of statementData) {
			stmt.error = null;
			stmt.fileName = null;
			const {
				month,
				clickableId
			} = stmt

			const newName = `${bank}_${formattedAccount}_${year}_${month}_statement.pdf`
			const newPath = path.join(downloadDir, newName);
			const randomMs = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000

			let cleanupHandler;
			const download = new Promise((resolve, reject) => {
				let thisDownloadId, thisSuggestedFilename;

				const onDownloadWillBegin = event => {
					console.log('⚡ download will begin → ', JSON.stringify(event));
					thisDownloadId = event.downloadId;
					thisSuggestedFilename = event.suggestedFilename
				}
				const onDownloadProgress = event => {
					// console.log('DEBUG: onDownloadProgress - event = ', JSON.stringify(event))
					if (event.downloadId === thisDownloadId && event.state === 'completed') {
						console.log('⚡ download completed');
						cleanupHandler()
						resolve(thisSuggestedFilename)
					}
				}

				const timeout = setTimeout(() => {
					downloadSession.off('Browser.downloadWillBegin', onDownloadWillBegin)
					downloadSession.off('Browser.downloadProgress', onDownloadProgress)
					reject(new Error(`Download Timedout for ${bank}_${formattedAccount}_${year}_${month}_statement.pdf`))
				}, 30000)

				cleanupHandler = () => {
					clearTimeout(timeout)
					downloadSession.off('Browser.downloadWillBegin', onDownloadWillBegin)
					downloadSession.off('Browser.downloadProgress', onDownloadProgress)
				}

				downloadSession.on('Browser.downloadWillBegin', onDownloadWillBegin)
				downloadSession.on('Browser.downloadProgress', onDownloadProgress)
			});

			// First network call made to download statement data
			const firstResponse = page.waitForResponse(response => response.url() === 'https://online.simplii.com/ebm-ai/api/v1/json/eStatements' && response.request().method() === 'POST', {
				timeout: 15000
			})

			try {
				// Delay
				await delay(randomMs)
				console.log('Delaying for : ', Math.floor(randomMs / 1000), ' seconds')

				// Trigger the download - only works if the Year (span) is visible and statement list is showing
				console.log(`Attempting to click button with ID:  ${clickableId}`)
				await page.click(`#${clickableId}`)

				const response = await firstResponse;
				// Ensures the first network call is a success
				if (!response.ok()) {
					const body = await response.text().catch(() => 'UNPARSABLE')
					stmt.error = {
						kind: 'HTTP_ERROR',
						status: response.status(),
						body
					}
					console.error(`❌ [${newName}] HTTP ${stmt.error.status}`)
					continue;
				}

				const oldName = await download;
				stmt.fileName = oldName;
				const oldPath = path.join(downloadDir, oldName)
				renameSync(oldPath, newPath);
				console.log(`✅ Renamed ${oldName} -> ${newName}`)
			} catch (error) {
				smt.error = {
					kind: 'EXCEPTION',
					error: error.message || err,
				}
				console.error(`⚠️ [${newName}] error: ${stmt.error.error}`)
			} finally {
				cleanupHandler();
			}
		}
	}
	/* Take an account and initiate statement download for every year */
	const processAccount = async function (accData) {
		for (const yearData of accData) {
			await downloadStatements({
				...yearData,
			})
		}
	}

	checkDownloadPath(downloadDir)

	console.log(browserWSEndpoint);

	/* Setup Puppeteer and required clients for automation */
	const browser = await puppeteer.connect({
		browserWSEndpoint: browserWSEndpoint,
		defaultViewport: {
			width: 1280,
			height: 999,
		},
	});

	const pages = await browser.pages();

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

	/* Make sure we start from the homepage */
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

	/* Process all required accounts */
	for (const acc of filteredAccList) {
		const accData = await getAccountData(acc);
		await makeAllYearsVisible(accData);
		// Process account specific data here!
		await getStatementList(accData);
		await processAccount(accData)
		bankData.push(accData);
	}
	informErrors(bankData);
	await browser.disconnect();
})(browserWSEndpoint, () => {
	console.log("cleanup invoked)");
});

await connectToPages;