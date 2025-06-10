import puppeteer from "puppeteer";
import {
	writeFile
} from "node:fs";
import "dotenv/config";

const browserWSEndpoint = process.argv[2];

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function debugFile(file, content) {
	writeFile(file, content, "utf8", (err) => {
		if (err) throw err;
		console.log(`Successfully wrote file :${file}`);
	});
}

const connectToPages = (async (browserWSEndpoint, cleanup) => {
	console.log(browserWSEndpoint);
	const browser = await puppeteer.connect({
		browserWSEndpoint: browserWSEndpoint,
		defaultViewport: {
			width: 1280,
			height: 999,
		},
	});

	const pages = await browser.pages();
	console.log(
		"Open pages: ",
		pages.map((p) => p.url())
	);

	// Filter simplii page and navigate to login page
	const simpliiPage = pages.filter((p) =>
		p.url().includes(process.env.SIMPLII_URL_INCLUDES)
	);
	const page = simpliiPage[0];

	const homeLink = await page.locator("a ::-p-text(Home)");
	await homeLink.click();

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
			const formattedAccount = account.split(" ").join("_");
			return {
				...acc,
				account,
				formattedAccount
			};
		});
	console.log(filteredAccList);

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
				});
			}
			yearData.statementData = buttonsData;
		}
	};
	for (const acc of filteredAccList) {
		const accData = await getAccountData(acc);
		// Process account specific data here!
		await getStatementList(accData);
		console.log(accData[0]);
		bankData.push(accData);
	}

	/*
	for (const accData of bankData){
		for (const yearData of accData){
			const selector = `#${yearData.spanId}`
			console.log(selector)
			const span = await page.$(selector);
			console.log(span)
			// const spanParent = await span.evaluateHandle(span => span.parentElement)
			// console.log(spanParent)
			// const contentDiv = await spanParent.evaluateHandle(div => div.nextElementSibling)
			// console.log(contentDiv)
		}
	}
*/

	/* Attach an array of monthly statement buttons to bank metadata
	
	*/
	// await delay(5000)

	await browser.disconnect();
})(browserWSEndpoint, () => {
	console.log("cleanup invoked)");
});

await connectToPages;