import re, subprocess, time, os
from playwright.sync_api import sync_playwright, expect
env = {**os.environ, 'DATABASE_URL': 'postgresql://postgres:@/okulum_ui?host=/tmp/pgdata', 'PORT': '3380', 'HOST': '127.0.0.1', 'SESSION_SECRET': 'smoke32-secret-0123456789abcdef', 'API_RATE_PER_MIN': '100000', 'WRITE_RATE_PER_MIN': '100000'}
srv = subprocess.Popen(['node','server.js'], cwd='/home/claude/okulum', env=env, stdout=open('/tmp/smoke32.log','w'), stderr=subprocess.STDOUT)
time.sleep(3); B='http://127.0.0.1:3380'; errors=[]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        c = b.new_context(viewport={'width':1280,'height':860}, locale='tr-TR')
        pg = c.new_page(); pg.route(re.compile(r'https://fonts\..*'), lambda r: r.abort()); pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(B+'/#/mudur-girisi'); expect(pg.locator('form[data-form=login]')).to_be_visible(timeout=20000)
        pg.fill('form[data-form=login] [name=username]', 'murat'); pg.fill('form[data-form=login] [name=password]', 'mudur-sifresi-1')
        pg.click('form[data-form=login] button[type=submit]'); expect(pg.locator('#app')).to_be_visible(timeout=20000); time.sleep(1)
        if pg.locator('form[data-form=kvkk]').count():
            pg.click('form[data-form=kvkk] .switch-ui'); pg.click('form[data-form=kvkk] button[type=submit]'); time.sleep(0.5)
        pg.goto(B+'/#/geogebra'); expect(pg.locator('.gx-input').first).to_be_visible(timeout=10000)
        pg.locator('.gx-input').first.fill('x^2-4'); time.sleep(0.8)
        pg.locator('[data-gx=add]').click(); time.sleep(0.2)
        pg.locator('.gx-input').nth(1).fill('A=(2, 0)'); time.sleep(0.8)
        pg.locator('.gx-input').nth(1).fill('2x+1'); time.sleep(0.8)
        pg.locator('.gx-input').nth(1).fill('sin('); time.sleep(0.6)
        print('hatalı satır mesajı:', pg.locator('.gx-error').count())
        pg.locator('.gx-input').nth(1).fill('2x+1'); time.sleep(0.8)
        colored = pg.evaluate("""() => { const c = document.querySelector('[data-gx=canvas]'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=0;i<d.length;i+=4){ if (d[i]<200 && d[i+1]>80 && d[i+1]<200 && d[i+2]<200) n++; } return n; }""")
        print('çizilen renkli piksel sayısı:', colored)
        pg.locator('[data-action=ggb-save]').click(); expect(pg.locator('form[data-form=ggb-save]')).to_be_visible(timeout=8000)
        pg.fill('form[data-form=ggb-save] [name=title]', 'Doğrusal fonksiyon'); pg.click('form[data-form=ggb-save] button[type=submit]')
        expect(pg.locator('text=Çalışma sınıfa kaydedildi').first).to_be_visible(timeout=8000)
        print('çalışma kaydedildi')
        pg.reload(); time.sleep(2)
        expect(pg.locator('[data-action=ggb-load]').first).to_be_visible(timeout=8000)
        pg.locator('.gx-input').first.fill(''); time.sleep(0.3)
        pg.locator('[data-action=ggb-load]').first.click(); time.sleep(1)
        print('yüklenen satırlar:', [pg.locator('.gx-input').nth(i).input_value() for i in range(pg.locator('.gx-input').count())])
        pg.screenshot(path='/tmp/shots/v32-graph.png')
        b.close()
finally:
    srv.terminate()
print('hatalar:', errors or 'yok')
