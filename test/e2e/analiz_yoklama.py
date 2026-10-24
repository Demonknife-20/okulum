import os
import re, subprocess, time, os, json
from playwright.sync_api import sync_playwright, expect
env = {**os.environ, 'DATABASE_URL': os.environ.get('E2E_DB', 'postgresql://postgres:@/okulum_ui?host=/tmp/pgdata'), 'PORT': '3347', 'HOST': '127.0.0.1', 'SESSION_SECRET': 'smoke21-secret-0123456789abcdef', 'API_RATE_PER_MIN': '100000', 'WRITE_RATE_PER_MIN': '100000', 'MAIL_OUTBOX_FILE': '/tmp/okulum-smoke-outbox.jsonl'}
srv = subprocess.Popen(['node','server.js'], cwd='/home/claude/okulum', env=env, stdout=open(os.path.join(os.environ.get('E2E_SHOTS', '/tmp'), 'smoke21.log'),'w'), stderr=subprocess.STDOUT)
time.sleep(2.5)
B='http://127.0.0.1:3347'
errors=[]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox'])
        def page_for(vp):
            c = b.new_context(viewport=vp, locale='tr-TR')
            c.add_init_script("localStorage.setItem('okulum-notify-dismissed','1')")
            pg = c.new_page(); pg.route(re.compile(r'https://fonts\..*'), lambda r: r.abort())
            pg.on('pageerror', lambda e: errors.append(str(e)))
            return c, pg
        def login(pg, user, pwd, portal):
            pg.goto(B+('/#/mudur-girisi' if portal=='principal' else '/#/giris'))
            expect(pg.locator('#publicView form[data-form=login]')).to_be_visible(timeout=8000)
            pg.fill('#publicView form[data-form=login] [name=username]', user)
            pg.fill('#publicView form[data-form=login] [name=password]', pwd)
            pg.click('#publicView form[data-form=login] button[type=submit]')
            expect(pg.locator('#app')).to_be_visible(timeout=8000)
            time.sleep(0.8)
        # Müdür: analiz
        cp, pp = page_for({'width':1360,'height':860})
        login(pp, 'murat', 'mudur-sifresi-1', 'principal')
        pp.goto(B+'/#/analiz'); expect(pp.locator('.stats').first).to_be_visible(timeout=8000)
        expect(pp.locator('text=Sınıflara göre devam').first).to_be_visible(timeout=8000)
        print('analiz sayfası: açıldı, paneller var')
        time.sleep(1.2); pp.screenshot(path=os.path.join(os.environ.get('E2E_SHOTS', '/tmp/shots'), 'v21-analiz.png'))
        # Öğretmen: yoklamada mazeretli düğmesi
        ct, pt = page_for({'width':1360,'height':860})
        login(pt, 'ayse', 'ogretmen-1234', 'member')
        pt.goto(B+'/#/attendance'); time.sleep(2.5)
        found = pt.locator('.seg-btn.excused').count()
        print('yoklama ekranı mazeretli düğmesi sayısı:', found)
        import subprocess as sp
        load = sp.run(['node','scripts/loadtest.mjs'], cwd='/home/claude/okulum', env={**os.environ, 'BASE_URL': B, 'USER': 'murat', 'PASS': 'mudur-sifresi-1', 'PORTAL': 'principal', 'CONCURRENCY': '80', 'SECONDS': '8', 'TARGET_PATH': '/api/me'}, capture_output=True, text=True, timeout=90)
        print('YUK:', load.stdout.strip() or load.stderr[-300:])
        b.close()
finally:
    srv.terminate()
print('hatalar:', errors or 'yok')
