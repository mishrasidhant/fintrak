import puppeteer from 'puppeteer'
import {writeFile} from 'node:fs'
import 'dotenv/config'

const browserWSEndpoint = process.argv[2];

function delay(ms){
	return new Promise(resolve => setTimeout(resolve, ms));
}

function debugFile(file, content){
	writeFile(file, content, 'utf8', (err) => {
		if (err) throw err;
		console.log(`Successfully wrote file :${file}`)
	});
}

const connectToPages = (async (browserWSEndpoint, cleanup) => {
	console.log(browserWSEndpoint)
	const browser = await puppeteer.connect({
		browserWSEndpoint: browserWSEndpoint,
		defaultViewport: {width: 1280, height: 999},
	})

	const pages = await browser.pages();
	console.log("Open pages: ", pages.map(p => p.url()));

	// Filter simplii page and navigate to login page 
	const simpliiPage = pages.filter(p =>  p.url().includes(process.env.SIMPLII_URL_INCLUDES))
	const page = simpliiPage[0]

	const statementLink = await page.locator('[data-test-id="olb-extras-view-estatements"]')
	await statementLink.scroll()
	delay(10000)
	await statementLink.click()
	await page.waitForNetworkIdle();
	console.log('network idle complete')

	// #ember1232 > div.online-statements > div.account-selector-section > div.account-list
	// #ember1247 : ui-select
	// #ember1247-field : select
	// #ember1253 : option
	// div.account-list ui-select
	// const options = await page.$$('#ember1246-field option');

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

	const optionsList = await page.$$eval('#ember1247-field option', async opts => 
		Promise.all(opts.map(async opt => ({
			value: opt.value,
			text: opt.textContent.trim(),
		})))
	);
	console.log(optionsList)

	delay(10000)


	await browser.disconnect()
})(browserWSEndpoint, () => { console.log('cleanup invoked)')})

await connectToPages