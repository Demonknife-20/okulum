import re, subprocess, time, os
from playwright.sync_api import sync_playwright, expect
env = {**os.environ, 'DATABASE_URL': 'postgresql://postgres:@/okulum_ui?host=/tmp/pgdata', 'PORT': '3395', 'HOST': '127.0.0.1', 'SESSION_SECRET': 'smoke34-secret-0123456789abcdef', 'API_RATE_PER_MIN': '100000', 'WRITE_RATE_PER_MIN': '100000'}
srv = subprocess.Popen(['node','server.js'], cwd='/home/claude/okulum', env=env, stdout=open('/tmp/smoke34.log','w'), stderr=subprocess.STDOUT)
time.sleep(3); B='http://127.0.0.1:3395'; errors=[]
def rows(pg): return [pg.locator('.gx-input').nth(i).input_value() for i in range(pg.locator('.gx-input').count())]
def canvas_box(pg):
    cv = pg.locator('[data-gx=canvas]'); cv.scroll_into_view_if_needed(); time.sleep(0.2); return cv.bounding_box()
def tap_canvas(pg, fx, fy):
    box = canvas_box(pg)
    x = box['x'] + box['width'] * fx
    y = min(box['y'] + box['height'] * fy, 844 - 150)
    pg.touchscreen.tap(x, y)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        c = b.new_context(viewport={'width':390,'height':844}, locale='tr-TR', has_touch=True, is_mobile=True, device_scale_factor=2)
        c.add_init_script("localStorage.setItem('okulum-notify-dismissed','1')")
        pg = c.new_page(); pg.route(re.compile(r'https://fonts\..*'), lambda r: r.abort()); pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(B+'/#/mudur-girisi'); expect(pg.locator('form[data-form=login]')).to_be_visible(timeout=20000)
        pg.fill('form[data-form=login] [name=username]', 'murat'); pg.fill('form[data-form=login] [name=password]', 'mudur-sifresi-1')
        pg.click('form[data-form=login] button[type=submit]'); time.sleep(2)
        if pg.locator('form[data-form=kvkk]').count():
            pg.locator('form[data-form=kvkk] .switch-ui').tap(); pg.locator('form[data-form=kvkk] button[type=submit]').tap(); time.sleep(0.5)
        pg.goto(B+'/#/geogebra'); expect(pg.locator('[data-gx=canvas]')).to_be_attached(timeout=10000); time.sleep(1)
        # Dokunmatik araçlar: nokta, doğru, çember
        pg.locator('[data-tool=point]').tap(); time.sleep(0.2)
        tap_canvas(pg, 0.25, 0.5); time.sleep(0.3)
        tap_canvas(pg, 0.75, 0.4); time.sleep(0.3)
        print('dokunma ile noktalar:', rows(pg))
        pg.locator('[data-tool=line]').tap(); time.sleep(0.2)
        tap_canvas(pg, 0.25, 0.5); time.sleep(0.3)
        tap_canvas(pg, 0.75, 0.4); time.sleep(0.3)
        print('dokunma ile doğru:', rows(pg))
        pg.locator('[data-tool=circle]').tap(); time.sleep(0.2)
        tap_canvas(pg, 0.5, 0.7); time.sleep(0.3)
        tap_canvas(pg, 0.8, 0.35); time.sleep(0.3)
        print('dokunma ile çember:', rows(pg)); print('HATALAR_ŞİMDİ', errors); pg.screenshot(path='/tmp/shots/v34-circle-fail.png')
        # Parmakla sürükleme (CDP): A noktasını taşı
        pg.locator('[data-tool=move]').tap(); time.sleep(0.2)
        box = canvas_box(pg)
        sx, sy = box['x']+box['width']*0.25, min(box['y']+box['height']*0.5, 844-150)
        cdp = c.new_cdp_session(pg)
        cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
        for k in range(1, 11):
            cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':sx+k*6,'y':sy-k*3}]})
            time.sleep(0.03)
        cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        time.sleep(0.5)
        print('parmakla sürükleme sonrası:', rows(pg))
        colored = pg.evaluate("""() => { const c = document.querySelector('[data-gx=canvas]'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=0;i<d.length;i+=4){ if (d[i]<120 && d[i+1]>60 && d[i+2]<140) n++; } return n; }""")
        print('renkli çizgi pikseli:', colored)
        pg.screenshot(path='/tmp/shots/v34-touch.png')
        b.close()
finally:
    srv.terminate()
print('hatalar:', errors or 'yok')
