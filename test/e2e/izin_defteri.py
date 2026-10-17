import re, subprocess, time, os
from playwright.sync_api import sync_playwright, expect
env = {**os.environ, 'DATABASE_URL': 'postgresql://postgres:@/okulum_ui?host=/tmp/pgdata', 'PORT': '3350', 'HOST': '127.0.0.1', 'SESSION_SECRET': 'smoke25-secret-0123456789abcdef', 'API_RATE_PER_MIN': '100000', 'WRITE_RATE_PER_MIN': '100000'}
srv = subprocess.Popen(['node','server.js'], cwd='/home/claude/okulum', env=env, stdout=open('/tmp/smoke25.log','w'), stderr=subprocess.STDOUT)
time.sleep(2.5); B='http://127.0.0.1:3350'; errors=[]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        c = b.new_context(viewport={'width':1360,'height':860}, locale='tr-TR')
        c.add_init_script("localStorage.setItem('okulum-notify-dismissed','1')")
        pg = c.new_page(); pg.route(re.compile(r'https://fonts\..*'), lambda r: r.abort())
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(B+'/#/mudur-girisi'); expect(pg.locator('#publicView form[data-form=login]')).to_be_visible(timeout=8000)
        pg.fill('#publicView form[data-form=login] [name=username]', 'murat'); pg.fill('#publicView form[data-form=login] [name=password]', 'mudur-sifresi-1')
        pg.click('#publicView form[data-form=login] button[type=submit]'); expect(pg.locator('#app')).to_be_visible(timeout=8000); time.sleep(0.8)
        if pg.locator('form[data-form=kvkk]').count():
            pg.click('form[data-form=kvkk] .switch-ui'); pg.click('form[data-form=kvkk] button[type=submit]')
        pg.goto(B+'/#/izin'); time.sleep(2.5)
        print('izin sayfası başlığı var:', pg.locator('h1', has_text='İzin defteri').count())
        print('pansiyon düğmesi:', pg.locator('[data-action=boarding-toggle]').count())
        pg.screenshot(path='/tmp/shots/v25-izin.png')
        b.close()
finally:
    srv.terminate()
print('hatalar:', errors or 'yok')
