import re, subprocess, time, os
from playwright.sync_api import sync_playwright, expect
env = {**os.environ, 'DATABASE_URL': 'postgresql://postgres:@/okulum_ui?host=/tmp/pgdata', 'PORT': '3390', 'HOST': '127.0.0.1', 'SESSION_SECRET': 'smoke33-secret-0123456789abcdef', 'API_RATE_PER_MIN': '100000', 'WRITE_RATE_PER_MIN': '100000'}
srv = subprocess.Popen(['node','server.js'], cwd='/home/claude/okulum', env=env, stdout=open('/tmp/smoke33.log','w'), stderr=subprocess.STDOUT)
time.sleep(3); B='http://127.0.0.1:3390'; errors=[]
def rows(pg): return [pg.locator('.gx-input').nth(i).input_value() for i in range(pg.locator('.gx-input').count())]
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
        pg.goto(B+'/#/geogebra'); expect(pg.locator('[data-gx=canvas]')).to_be_visible(timeout=10000); time.sleep(1)
        cv = pg.locator('[data-gx=canvas]'); box = cv.bounding_box()
        # Nokta aracı: iki nokta
        pg.click('[data-tool=point]')
        pg.mouse.click(box['x']+box['width']*0.3, box['y']+box['height']*0.5); time.sleep(0.2)
        pg.mouse.click(box['x']+box['width']*0.7, box['y']+box['height']*0.4); time.sleep(0.4)
        print('noktalardan sonra satırlar:', rows(pg))
        # Doğru aracı: A ve B
        box = cv.bounding_box(); pg.click('[data-tool=line]')
        pg.mouse.click(box['x']+box['width']*0.3, box['y']+box['height']*0.5); time.sleep(0.2)
        pg.mouse.click(box['x']+box['width']*0.7, box['y']+box['height']*0.4); time.sleep(0.4)
        # Işın aracı: B ve A
        pg.click('[data-tool=ray]'); time.sleep(0.2); box = cv.bounding_box(); print('kutu:', box)
        print('araç:', pg.locator('[data-tool].on').get_attribute('data-tool'), '| ipucu:', pg.locator('[data-gx=hint]').inner_text())
        pg.mouse.click(box['x']+box['width']*0.7, box['y']+box['height']*0.4); time.sleep(0.3)
        print('ilk tıklama ipucu:', pg.locator('[data-gx=hint]').inner_text(), '| satırlar:', rows(pg))
        pg.mouse.click(box['x']+box['width']*0.5, box['y']+box['height']*0.3); time.sleep(0.4)
        print('ikinci tıklama ipucu:', pg.locator('[data-gx=hint]').inner_text())
        print('doğru ve ışın sonrası satırlar:', rows(pg))
        # Taşı aracı: A noktasını sürükle
        box = cv.bounding_box(); pg.click('[data-tool=move]')
        pg.mouse.move(box['x']+box['width']*0.3, box['y']+box['height']*0.5); pg.mouse.down()
        for k in range(1, 11):
            pg.mouse.move(box['x']+box['width']*(0.3-0.02*k), box['y']+box['height']*(0.5-0.02*k))
        pg.mouse.up(); time.sleep(0.5)
        print('sürükleme sonrası satırlar:', rows(pg))
        # Çizim kontrolü: renkli pikseller
        colored = pg.evaluate("""() => { const c = document.querySelector('[data-gx=canvas]'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=0;i<d.length;i+=4){ if (d[i]<120 && d[i+1]>60 && d[i+2]<140) n++; } return n; }""")
        print('renkli çizgi pikseli:', colored)
        pg.screenshot(path='/tmp/shots/v33-graph.png')
        b.close()
finally:
    srv.terminate()
print('hatalar:', errors or 'yok')
