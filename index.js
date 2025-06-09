// Create the browser instance and open all pages
import puppeteer from 'puppeteer'

import 'dotenv/config'

function delay(ms){
	return new Promise(resolve => setTimeout(resolve, ms));
}

const launchAllPages = (async () => {
	const browser = await puppeteer.launch(
		{
			headless: false,
			defaultViewport: {width: 1280, height: 999},
			// browser: 'firefox',
		}
	)
	const browserWSEndpoint = browser.wsEndpoint()

	async function cleanup (){
		console.log('Disconnecting puppetere instance from browser');
		await browser.disconnect();
	}
	// Create page for first bank and sign-in
	const page = await browser.newPage()
	await delay(10000)
	await page.goto(process.env.SIMPLII_URL)
	await delay(10000)
	await page.locator('#onetrust-accept-btn-handler').click();
	await page.locator('#sign-on').click()
	await page.locator('[id^="card-number"]').fill(process.env.SIMPLII_UN)
	await page.locator('[id^="card-number"]').fill(process.env.SIMPLII_UN)
	// #password-08012640 vs #password-fd795132 : "the suffix is browser dependant :dynamic"
	await page.locator('[id^="password"]').fill(process.env.SIMPLII_PW)
	await page.locator('#button-1516987113640').click();
	return { browserWSEndpoint, cleanup }
})()

process.on('SIGINT', async ()=>{
	console.log('Exit gracefully : SIGINT')
	await cleanup()
	process.exit(0)
})

process.on('SIGTERM', async ()=>{
	console.log('Exit gracefully : SIGINT')
	await cleanup()
	process.exit(0)
})

const { browserWSEndpoint, cleanup } = await launchAllPages
console.log(browserWSEndpoint)