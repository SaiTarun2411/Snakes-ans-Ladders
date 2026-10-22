"""Optional Chromium checks for mobile fullscreen and its browser fallback."""
from playwright.sync_api import sync_playwright,expect
import os
URL=os.environ.get('GAME_TEST_URL','http://localhost:8501')
with sync_playwright() as p:
 b=p.chromium.launch()
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL)
 f=page.frame_locator('iframe[title="app.snakes_ladders"]')
 expect(f.locator('#fullscreen')).to_be_visible(timeout=30000)
 f.locator('[data-mode="local"]').click();f.locator('[data-count="4"]').click();f.locator('#start').click()
 expect(f.locator('#dice-0')).to_be_enabled(timeout=10000)
 f.locator('#fullscreen').click()
 expect(f.locator('#fullscreen')).to_have_attribute('aria-pressed','true',timeout=5000)
 child=next(fr for fr in page.frames if '/component/' in fr.url)
 native=child.evaluate('Boolean(document.fullscreenElement)')
 assert native,'Chrome should use the native fullscreen API'
 def bounds():
  return child.evaluate('''() => {
    const board=document.querySelector('.board-wrap').getBoundingClientRect();
    const cards=[...document.querySelectorAll('.player-card')].map(e=>e.getBoundingClientRect());
    return {width:innerWidth,height:innerHeight,board:{x:board.x,y:board.y,right:board.right,bottom:board.bottom},cards:cards.map(r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom}))};
  }''')
 result=bounds();assert result['board']['bottom']<result['height'],result
 assert all(r['bottom']<=result['height'] and r['right']<=result['width'] for r in result['cards']),result
 page.screenshot(path='/tmp/fullscreen-portrait.png',full_page=True)
 f.locator('#fullscreen').click();expect(f.locator('#fullscreen')).to_have_attribute('aria-pressed','false')
 page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(300)
 f.locator('#fullscreen').click();expect(f.locator('#fullscreen')).to_have_attribute('aria-pressed','true')
 page.wait_for_timeout(300)
 result=bounds();assert result['board']['bottom']<=result['height'],result
 assert all(r['bottom']<=result['height'] and r['right']<=result['width'] for r in result['cards']),result
 page.screenshot(path='/tmp/fullscreen-landscape.png',full_page=True)
 f.locator('#fullscreen').click();expect(f.locator('#fullscreen')).to_have_attribute('aria-pressed','false')
 assert not child.evaluate('Boolean(document.fullscreenElement)')
 page.set_viewport_size({'width':390,'height':844})
 # Simulate a mobile browser without the DOM Fullscreen API.
 child.evaluate("() => {Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:undefined});Object.defineProperty(document.documentElement,'webkitRequestFullscreen',{configurable:true,value:undefined});}")
 f.locator('#fullscreen').click();expect(f.locator('#fullscreen')).to_have_attribute('aria-pressed','true')
 assert child.evaluate('document.documentElement.classList.contains("focus-mode")')
 assert page.locator('iframe').evaluate("e=>e.style.position==='fixed'")
 f.locator('#dice-0').click();expect(f.locator('#dice-1')).to_be_enabled(timeout=12000)
 expect(f.locator('#fullscreen')).to_have_attribute('aria-pressed','true')
 f.locator('#fullscreen').click();expect(f.locator('#fullscreen')).to_have_attribute('aria-pressed','false')
 assert page.locator('iframe').evaluate("e=>e.style.position!=='fixed'")
 child.evaluate('() => {delete document.documentElement.requestFullscreen;delete document.documentElement.webkitRequestFullscreen;}')
 f.locator('#exit').click();expect(f.locator('.floating-die')).to_be_visible(timeout=10000)
 f.locator('.floating-die').click();f.locator('[data-mode="local"]').click();f.locator('[data-count="4"]').click();f.locator('#start').click()
 expect(f.locator('.ludo-token')).to_have_count(16,timeout=10000)
 f.locator('#fullscreen').click();expect(f.locator('#fullscreen')).to_have_attribute('aria-pressed','true')
 result=bounds();assert all(r['bottom']<=result['height'] for r in result['cards']),result
 child.evaluate('() => document.exitFullscreen()')
 expect(f.locator('#fullscreen')).to_have_attribute('aria-pressed','false')
 assert not errors,errors
 print('PASS: native mobile fullscreen, portrait/landscape board and all four player controls fit, exit, unsupported-browser fallback, gameplay preserves expanded mode.')
 b.close()
