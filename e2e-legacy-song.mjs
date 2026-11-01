// User flow: a song saved by an older browser-only version remains editable
// locally and imports once into the owner database with a valid ID.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5201'
const legacy = {
  id: 'old_browser_123',
  title: 'My old song',
  rawTab: 'C G Am F',
  youtubeId: null,
  steps: [],
  savedAt: Date.now(),
  revision: 1,
}
const browser = await chromium.launch()

async function seed(page) {
  await page.goto(base)
  await page.evaluate(
    (song) =>
      localStorage.setItem('fretbloom.songbook.v1', JSON.stringify([song])),
    legacy,
  )
}

async function edit(page, nextTitle) {
  await page.getByRole('button', { name: 'Edit My old song' }).click()
  await page.getByLabel('Song title').fill(nextTitle)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('button', { name: `Edit ${nextTitle}` }).waitFor()
}

try {
  const local = await browser.newContext()
  await local.route('**/api/songs', (route) =>
    route.fulfill({ status: 404, json: { error: 'local mode' } }),
  )
  const localPage = await local.newPage()
  await seed(localPage)
  await localPage.goto(`${base}/songbook`)
  await edit(localPage, 'Local edit')
  await localPage.reload()
  await localPage.getByRole('button', { name: 'Edit Local edit' }).waitFor()
  assert.equal(
    await localPage.evaluate(
      () => JSON.parse(localStorage.getItem('fretbloom.songbook.v1'))[0].id,
    ),
    legacy.id,
  )
  await local.close()
  console.log('PASS an older browser song remains editable without a database')

  const owner = await browser.newContext()
  let remoteSongs = []
  const puts = []
  await owner.route('**/api/songs**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ status: 200, json: remoteSongs })
      return
    }
    if (request.method() === 'PUT') {
      const song = request.postDataJSON()
      puts.push({
        id: song.id,
        expected: request.headers()['x-song-revision'],
      })
      remoteSongs = [song]
      await route.fulfill({ status: 200, json: song })
      return
    }
    await route.fulfill({ status: 405 })
  })
  const ownerPage = await owner.newPage()
  await seed(ownerPage)
  await ownerPage.goto(`${base}/songbook`)
  await ownerPage.getByRole('button', { name: 'Edit My old song' }).waitFor()
  assert.match(remoteSongs[0].id, /^song-local-[a-f0-9]{16}$/)
  assert.deepEqual(puts, [{ id: remoteSongs[0].id, expected: '0' }])
  assert.equal(
    await ownerPage.evaluate(() =>
      localStorage.getItem('fretbloom.songbook.v1'),
    ),
    null,
  )
  await edit(ownerPage, 'Owner edit')
  await ownerPage.reload()
  await ownerPage.getByRole('button', { name: 'Edit Owner edit' }).waitFor()
  assert.equal(remoteSongs[0].title, 'Owner edit')
  assert.equal(puts.at(-1).expected, '1')
  await owner.close()
  console.log(
    'PASS an older browser song imports once, edits, and reloads from the owner database',
  )
} finally {
  await browser.close()
}
