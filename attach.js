import puppeteer from "puppeteer";
import 'dotenv/config'

const browserWSEndpoint = process.argv[2];

function delay(ms){
	return new Promise(resolve => setTimeout(resolve, ms));
}

const connectToPages = (async (browserWSEndpoint, cleanup) => {
	// const {browserWSEndpoint, cleanup} = await launchAllPages
	console.log(browserWSEndpoint)
	const browser = await puppeteer.connect({
		browserWSEndpoint: browserWSEndpoint,
		defaultViewport: {width: 1080, height: 1024},
	})
	console.log('At this point we have 2 puppetere instances connected to the browser')
	// TODO Implement when attach logic has access to the initial page launch context, 
	// for now the initial page launch logic handles it's own cleanup
	// await cleanup() 
	// console.log('At this point we should have 1 puppetere instance connected to the browser')

	const pages = await browser.pages();
	console.log("Open pages: ", pages.map(p => p.url()));

	// Filter simplii page and navigate to login page 
	const simpliiPage = pages.filter(p =>  p.url().includes(process.env.SIMPLII_URL_INCLUDES))
	const page = simpliiPage[0]

	await page.locator('#button-1516987113640').hover();
	delay(2000)
	await browser.disconnect()
})(browserWSEndpoint, () => { console.log('cleanup invoked)')})

await connectToPages