import os
import re, subprocess, time, os, json
from playwright.sync_api import sync_playwright, expect
env = {**os.environ, 'DATABASE_URL': os.environ.get('E2E_DB', 'postgresql://postgres:@/okulum_ui?host=/tmp/pgdata'), 'PORT': '3398', 'HOST': '127.0.0.1', 'SESSION_SECRET': 'smoke38-secret-0123456789abcdef', 'API_RATE_PER_MIN': '100000', 'WRITE_RATE_PER_MIN': '100000'}
srv = subprocess.Popen(['node','server.js'], cwd='/home/claude/okulum', env=env, stdout=open(os.path.join(os.environ.get('E2E_SHOTS', '/tmp'), 'smoke38.log'),'w'), stderr=subprocess.STDOUT)
time.sleep(3); B='http://127.0.0.1:3398'; errors=[]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox'])
        c = b.new_context(viewport={'width':1280,'height':900}, locale='tr-TR')
        c.add_init_script("localStorage.setItem('okulum-notify-dismissed','1')")
        pg = c.new_page(); reqlog=[]; pg.on('request', lambda r: reqlog.append(r.method+' '+r.url) if '/api/' in r.url and r.method!='GET' else None); pg.on('console', lambda m: errors.append('console:'+m.text) if (m.type=='error' or 'GGB' in m.text) else None); pg.route(re.compile(r'https://fonts\..*'), lambda r: r.abort()); pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(B+'/#/mudur-girisi'); expect(pg.locator('form[data-form=login]')).to_be_visible(timeout=20000)
        pg.fill('form[data-form=login] [name=username]', 'murat'); pg.fill('form[data-form=login] [name=password]', 'mudur-sifresi-1')
        pg.click('form[data-form=login] button[type=submit]'); expect(pg.locator('#app')).to_be_visible(timeout=20000); time.sleep(1)
        if pg.locator('form[data-form=kvkk]').count():
            pg.click('form[data-form=kvkk] .switch-ui'); pg.click('form[data-form=kvkk] button[type=submit]'); time.sleep(0.5)
        api = lambda method, path, body=None: pg.evaluate("""async ([m, p, b]) => { const r = await fetch('/api' + p, {method: m, headers: {'Content-Type': 'application/json'}, body: b ? JSON.stringify(b) : undefined}); return {status: r.status, data: await r.json().catch(() => null)}; }""", [method, path, body])
        classes = api('GET', '/classes')['data']['classes']
        cid = classes[0]['id']
        board = api('POST', '/boards', {'title': 'Duvar denemesi', 'scope': 'class', 'classId': cid, 'layout': 'wall', 'background': 'sky'})
        assert board['status'] == 201, board
        bid = board['data']['id']
        n1 = api('POST', f'/boards/{bid}/notes', {'title': 'Birinci kart', 'body': 'Sürükle beni', 'color': 'mint'})
        n2 = api('POST', f'/boards/{bid}/notes', {'title': 'İkinci kart', 'body': 'Beğen ve yorum yap', 'color': 'coral'})
        print('pano oluşturuldu:', board['status'], n1['status'], n2['status'])
        pg.goto(B+f'/#/pano?id={bid}'); expect(pg.locator('[data-wall]')).to_be_visible(timeout=10000); time.sleep(0.8)
        print('düzen duvar, kart sayısı:', pg.locator('[data-wall] .pin').count(), '| yükseklik stili:', pg.locator('[data-wall]').evaluate('e => e.style.height'))
        card = pg.locator('[data-wall] .pin', has_text='Birinci kart')
        before = card.bounding_box()
        pg.mouse.move(before['x']+40, before['y']+30); pg.mouse.down()
        for k in range(1, 9):
            pg.mouse.move(before['x']+40+k*15, before['y']+30+k*8); time.sleep(0.02)
        pg.mouse.up(); time.sleep(1.2); print('SÜRÜKLEME-İSTEKLERİ', reqlog)
        after = card.bounding_box()
        print('sürükleme: dx=%.0f dy=%.0f' % (after['x']-before['x'], after['y']-before['y']))
        notes = api('GET', f'/boards/{bid}/notes')['data']['notes']
        saved = [n for n in notes if n['title']=='Birinci kart'][0]
        print('kaydedilen konum:', saved['posX'], saved['posY'])
        print('HATALAR-ARA', errors)
        pg.reload(); expect(pg.locator('[data-wall]')).to_be_visible(timeout=10000); time.sleep(0.8)
        reloaded = pg.locator('[data-wall] .pin', has_text='Birinci kart').bounding_box()
        print('yeniden yüklemede konum korundu:', abs(reloaded['x']-after['x']) < 3 or abs(reloaded['x']-before['x']) > 20)
        like = pg.locator('[data-wall] .pin', has_text='İkinci kart').locator('.pin-like'); like.click(); time.sleep(0.8)
        print('beğeni düğmesi:', like.inner_text().strip(), '| beğeni sayısı alanı:', like.locator('b').inner_text())
        pg.locator('[data-wall] .pin', has_text='İkinci kart').locator('.pin-comments').click(); expect(pg.locator('form[data-form=note-comment]')).to_be_visible(timeout=8000)
        pg.fill('form[data-form=note-comment] [name=body]', 'Tarayıcıdan yazılan yorum'); pg.click('form[data-form=note-comment] button[type=submit]'); time.sleep(0.8)
        comments = api('GET', f"/board-notes/{[n for n in notes if n['title']=='İkinci kart'][0]['id']}/comments")['data']['comments']
        print('yorum kaydedildi:', any(c['body']=='Tarayıcıdan yazılan yorum' for c in comments))
        pg.screenshot(path=os.path.join(os.environ.get('E2E_SHOTS', '/tmp/shots'), 'v38-wall.png'))
        print('İSTEKLER', reqlog[-8:])
        b.close()
finally:
    srv.terminate()
print('hatalar:', errors or 'yok')
