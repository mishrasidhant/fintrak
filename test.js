import puppeteer from "puppeteer";

function delay(ms){
	return new Promise(resolve => setTimeout(resolve, ms));
}

const launchAllPages = (async () => {
	const browser = await puppeteer.launch({headless: false})
	const browserWSEndpoint = browser.wsEndpoint()

	async function cleanup (){
		console.log('Disconnecting puppetere instance from browser');
		await browser.disconnect();
	}


	// const page1 = await browser.newPage();
	// const page2 = await browser.newPage();
	// const page3 = await browser.newPage();
	// await page1.goto('https://google.com')
	// await page2.goto('https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_selectors')
	// await page3.goto('https://backbonejs.org/')

	const pages = [
		'https://www.simplii.com/en/home.html',
		'https://www.tangerine.ca/app/#/login/login-id?locale=en_CA',
		'https://www.tangerine.ca/en/personal',
		'https://www.mbna.ca/en'
	]
	await Promise.all(pages.map(async (el) =>{
		const page = await browser.newPage()
		await page.goto(el)
	}))
	return { browserWSEndpoint, cleanup }
})()

const connectToPages = (async () => {
	const {browserWSEndpoint, cleanup} = await launchAllPages
	console.log(browserWSEndpoint)
	const browser = await puppeteer.connect({
		browserWSEndpoint: browserWSEndpoint
	})
	console.log('At this point we have 2 puppetere instances connected to the browser')
	await cleanup()
	console.log('At this point we should have 1 puppetere instance connected to the browser')
	const pages = await browser.pages();
	console.log("Open pages: ", pages.map(p => p.url()));
	await browser.disconnect()
})()
// await connectToPages
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


(async () => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();

  // Navigate the page to a URL
  await page.goto('https://www.simplii.com/en/home.html');
  await page.locator('#onetrust-accept-btn-handler').click();
  await page.locator('#sign-on').click();
  await page.locator('#card-number-08012640').fill('12345678') //  Replace with env var for UN
  await page.locator('#password-08012640').fill('password') //  Replace with env var for UN
  await page.locator('#button-1516987113640').hover();
  await delay(5000);

/*
  // Set screen size
  await page.setViewport({width: 1080, height: 1024});

  // Type into search box
  await page.type('.devsite-search-field', 'automate beyond recorder');

  // Wait and click on first result
  const searchResultSelector = '.devsite-result-item-link';
  await page.waitForSelector(searchResultSelector);
  await page.click(searchResultSelector);

  // Locate the full title with a unique string
  const textSelector = await page.waitForSelector(
    'text/Customize and automate',
  );
  const fullTitle = await textSelector?.evaluate(el => el.textContent);

  // Print the full title
  console.log('The title of this blog post is "%s".', fullTitle);
*/
  await browser.close();
})();