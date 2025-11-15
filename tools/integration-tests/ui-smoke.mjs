const BASE_URL = process.env.BASE_URL || 'http://localhost:8080'
async function main(){
  let pw
  try{ pw = await import('playwright') }catch(e){
    console.error('PLAYWRIGHT_MISSING')
    process.exitCode = 2
    return
  }
  const timeoutMs = parseInt(process.env.UI_TIMEOUT_MS || '8000', 10)
  const browser = await pw.chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(timeoutMs)
  context.setDefaultTimeout(timeoutMs)
  const requests = []
  page.on('request', req => { requests.push({ url: req.url(), method: req.method(), postData: req.postData() }) })
  try {
    await page.goto(`${BASE_URL}/ui/index.html`, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
  } catch(e) {
    console.error('UI_PAGE_TIMEOUT')
    await browser.close()
    process.exit(3)
  }
  const brightness = await page.$('#brightness')
  const softness = await page.$('#softness')
  const color = await page.$('#color')
  const speed = await page.$('#speed')
  if(!brightness || !softness || !color || !speed){
    console.error('SLIDERS_MISSING')
    await browser.close(); process.exit(1)
  }
  const bMin = await page.evaluate(el => el.min, brightness)
  const bMax = await page.evaluate(el => el.max, brightness)
  const bStep = await page.evaluate(el => el.step, brightness)
  if(!(bMin==='0' && bMax==='1' && (bStep==='0.01' || bStep==='0.010'))){
    console.error('BOUNDS_NOT_APPLIED')
    await browser.close(); process.exit(1)
  }
  await page.evaluate(el => { el.value = '0.7' }, brightness)
  await brightness.dispatchEvent('input')
  await brightness.dispatchEvent('change')
  await page.waitForTimeout(800)
  const paramsPost = requests.find(r => r.url.endsWith('/api/params') && r.method === 'POST')
  if(!paramsPost){ console.error('PARAMS_POST_MISSING'); await browser.close(); process.exit(1) }
  const paletteSelect = await page.$('#palette-select')
  if(!paletteSelect){ console.error('PALETTE_SELECT_MISSING'); await browser.close(); process.exit(1) }
  await page.selectOption('#palette-select', '2')
  await page.waitForTimeout(500)
  const palettePost = requests.find(r => r.url.endsWith('/api/params') && r.method==='POST' && ((r.postData||'').includes?.('palette_id') || String(r.postData||'').includes('palette_id')))
  if(!palettePost){ console.error('PALETTE_POST_MISSING'); await browser.close(); process.exit(1) }
  // Audio gain update
  const gain = await page.$('#microphone-gain')
  if(!gain){ console.error('GAIN_SLIDER_MISSING'); await browser.close(); process.exit(1) }
  await page.evaluate(el => { el.value = '1.20' }, gain)
  await gain.dispatchEvent('input')
  await page.waitForTimeout(800)
  const audioPost = requests.find(r => r.url.endsWith('/api/audio-config') && r.method==='POST')
  if(!audioPost){ console.error('AUDIO_CONFIG_POST_MISSING'); await browser.close(); process.exit(1) }
  const audioCfg = await page.evaluate(async () => (await fetch('/api/audio-config')).json())
  if(!(audioCfg && typeof audioCfg.microphone_gain==='number' && Math.abs(audioCfg.microphone_gain - 1.2) < 0.01)){
    console.error('AUDIO_CONFIG_NOT_APPLIED')
    await browser.close(); process.exit(1)
  }
  console.log('UI_SMOKE_OK')
  await browser.close()
}
main()