// Create the browser instance and open all pages
import puppeteer from 'puppeteer';
import 'dotenv/config'

function delay(ms){
	return new Promise(resolve => setTimeout(resolve, ms));
}

const launchAllPages = (async () => {
	const browser = await puppeteer.launch(
		{
			headless: false,
			defaultViewport: {width: 1080, height: 1024}	
		}
	)
	const browserWSEndpoint = browser.wsEndpoint()

	async function cleanup (){
		console.log('Disconnecting puppetere instance from browser');
		await browser.disconnect();
	}
/*
	const pages = [
		'https://www.simplii.com/en/home.html',
		// 'https://www.tangerine.ca/app/#/login/login-id?locale=en_CA',
		// 'https://www.tangerine.ca/en/personal',
		// 'https://www.mbna.ca/en'
	]
	await Promise.all(pages.map(async (el) =>{
		const page = await browser.newPage()
		await page.goto(el)
	}))
*/
	// Create page for first bank and sign-in
	const page = await browser.newPage()
	await page.goto(process.env.SIMPLII_URL)
	await page.locator('#onetrust-accept-btn-handler').click();
	await page.locator('#sign-on').click();
	// #card-number-08012640  vs  #card-number-fd795132  - different for ffx and chrome
	// use partial selector matching
	await page.locator('[id^="card-number"]').fill(process.env.SIMPLII_UN)
	// #password-08012640 vs #password-fd795132 - ""
	await page.locator('[id^="password"]').fill(process.env.SIMPLII_PW)
	// await page.locator('#button-1516987113640').hover();

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