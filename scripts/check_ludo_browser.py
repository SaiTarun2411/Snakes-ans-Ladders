"""Deterministic Ludo browser checks in a separate test-only Streamlit process."""
import atexit
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
temporary=tempfile.TemporaryDirectory(prefix='clubhouse-ludo-')
atexit.register(temporary.cleanup)
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0))
    port=sock.getsockname()[1]
fixture=Path(temporary.name)/'fixture.py'
fixture_source='import sys\nsys.path.insert(0, '+repr(str(root))+')\n'+'''
import ludo
from app import main
if not hasattr(ludo, '_fixture_original_roll'):
    ludo._fixture_original_roll=ludo.roll_ludo
def fixture_roll(game,version,roll=None,now=None):
    return ludo._fixture_original_roll(game,version,6,now)
ludo.roll_ludo=fixture_roll
main()
'''
fixture.write_text(fixture_source)
process=subprocess.Popen([sys.executable,'-m','streamlit','run',str(fixture),'--server.port',str(port),'--server.headless','true','--browser.gatherUsageStats','false'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,cwd=root)
atexit.register(process.terminate)
URL=f'http://localhost:{port}'
for attempt in range(100):
    try:
        with socket.create_connection(('127.0.0.1',port),timeout=.1):
            break
    except OSError:
        time.sleep(.1)
else:
    raise RuntimeError('The Ludo browser-test server did not start.')
with sync_playwright() as p:
 b=p.chromium.launch();context=b.new_context(viewport={'width':1440,'height':1150});page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.goto(URL)
 f=page.frame_locator('iframe[title="app.snakes_ladders"]')
 expect(f.locator('.floating-die')).to_be_visible(timeout=30000)
 f.locator('.floating-die').click()
 expect(f.locator('.brand')).to_contain_text('LUDO')
 page.screenshot(path='/tmp/ludo-home.png',full_page=True)
 f.locator('[data-mode="local"]').click();f.locator('[data-count="4"]').click();f.locator('#start').click()
 expect(f.locator('.ludo-token')).to_have_count(16,timeout=10000)
 expect(f.locator('#dice-0')).to_be_enabled()
 assert f.locator('.history').count()==f.locator('.game-aside').count()==f.locator('.footer').count()==0
 f.locator('#dice-0').click();expect(f.locator('.selectable')).to_have_count(4,timeout=10000)
 f.locator('#piece-0-0').click();expect(f.locator('#dice-0')).to_be_enabled(timeout=10000)
 f.locator('#dice-0').click();expect(f.locator('#piece-0-0')).to_be_enabled(timeout=10000)
 origin=f.locator('#piece-0-0').get_attribute('style')
 f.locator('#piece-0-0').click();expect(f.locator('#dice-0')).to_be_enabled(timeout=10000)
 assert origin!=f.locator('#piece-0-0').get_attribute('style')
 page.screenshot(path='/tmp/ludo-four-players.png',full_page=True)
 f.locator('#dice-0').click();expect(f.locator('#dice-1')).to_be_enabled(timeout=10000)
 f.locator('#exit').click();expect(f.locator('[data-mode="computer"]')).to_be_visible(timeout=10000)
 f.locator('[data-mode="computer"]').click();f.locator('#start').click()
 expect(f.locator('#dice-0')).to_be_enabled(timeout=10000)
 cpu_start=f.locator('#piece-1-0').get_attribute('style')
 for _ in range(2):
  f.locator('#dice-0').click();expect(f.locator('#piece-0-0')).to_be_enabled(timeout=10000);f.locator('#piece-0-0').click();expect(f.locator('#dice-0')).to_be_enabled(timeout=10000)
 f.locator('#dice-0').click();expect(f.locator('#dice-0')).to_be_enabled(timeout=30000)
 assert cpu_start!=f.locator('#piece-1-0').get_attribute('style')
 f.locator('#exit').click();expect(f.locator('[data-mode="friends"]')).to_be_visible(timeout=10000)
 f.locator('[data-mode="friends"]').click();f.locator('#name').fill('Alice');f.locator('#start').click()
 expect(f.locator('.room-code')).to_be_visible(timeout=10000)
 code=f.locator('.room-code').inner_text();child=next(fr for fr in page.frames if '/component/' in fr.url)
 child.evaluate('''() => Object.defineProperty(navigator,'share',{configurable:true,value:async(payload)=>{window.shared=payload}})''')
 f.locator('#share-room').click()
 shared=child.evaluate('window.shared');assert shared and 'game=ludo' in shared['url'] and f'room={code}' in shared['url'],shared
 child.evaluate('''() => Object.defineProperty(navigator,'share',{configurable:true,value:undefined})''')
 f.locator('#share-room').click();expect(f.locator('#share-dialog')).to_be_visible()
 assert f.locator('#share-link').input_value()==shared['url']
 assert 'wa.me' in f.locator('#share-dialog a').first.get_attribute('href')
 f.locator('#close-share').click()
 guest_context=b.new_context(viewport={'width':390,'height':844},is_mobile=True);guest=guest_context.new_page();guest.on('pageerror',lambda e:errors.append(str(e)))
 guest.goto(shared['url']);gf=guest.frame_locator('iframe[title="app.snakes_ladders"]')
 expect(gf.locator('#room-input')).to_have_value(code,timeout=30000)
 expect(gf.locator('.brand')).to_contain_text('LUDO')
 gf.locator('#name').fill('Bob');gf.locator('#start').click()
 expect(f.locator('#begin')).to_be_enabled(timeout=10000);f.locator('#begin').click()
 expect(f.locator('#dice-0')).to_be_enabled(timeout=10000)
 expect(gf.locator('#dice-0')).to_be_disabled()
 f.locator('#dice-0').click();expect(f.locator('#piece-0-0')).to_be_enabled(timeout=10000)
 expect(gf.locator('#piece-0-0')).to_be_disabled()
 f.locator('#piece-0-0').click();expect(f.locator('#dice-0')).to_be_enabled(timeout=10000)
 expect(gf.locator('#piece-0-0')).to_have_attribute('style',f.locator('#piece-0-0').get_attribute('style'),timeout=5000)
 guest.screenshot(path='/tmp/ludo-mobile-game.png',full_page=True)
 assert not errors,errors
 print('PASS: dice switch, 4x4 tokens, token selection/movement, third-six forfeit, CPU roll+move, native share payload, app fallback, direct invite, room sync, mobile, no history/footer, no JS errors.')
 b.close()
