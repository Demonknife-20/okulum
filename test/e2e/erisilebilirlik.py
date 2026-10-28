import os
import re, subprocess, time, os, json
from playwright.sync_api import sync_playwright, expect
AXE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'node_modules', 'axe-core', 'axe.min.js'), encoding='utf8').read()
env = {**os.environ, 'DATABASE_URL': 'postgresql://postgres:@/okulum_ui?host=/tmp/pgdata', 'PORT': '3422', 'HOST': '127.0.0.1', 'SESSION_SECRET': 'a11y-secret-0123456789abcdef', 'API_RATE_PER_MIN': '100000'}
srv = subprocess.Popen(['node','server.js'], cwd='/home/claude/okulum', env=env, stdout=open('/tmp/a11y.log','w'), stderr=subprocess.STDOUT)
time.sleep(3); B='http://127.0.0.1:3422'
PAGES = ['/#/'+r for r in ['overview','people','school','audit','yardim','panolar','asistan','sinavlar','notlar','davranis','program','takvim','canli','analiz','izin','gece','geogebra','fizik','kimya','bilgisayar','kullanim','messages']]
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--no-sandbox'])
        c = b.new_context(viewport={'width':1280,'height':900}, locale='tr-TR')
        c.add_init_script("localStorage.setItem('okulum-notify-dismissed','1')")
        c.add_init_script(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'node_modules', 'axe-core', 'axe.min.js'))
        pg = c.new_page(); pg.route(re.compile(r'https://fonts\..*'), lambda r: r.abort())
        pg.goto(B+'/#/mudur-girisi'); expect(pg.locator('form[data-form=login]')).to_be_visible(timeout=20000)
        pg.fill('form[data-form=login] [name=username]', 'murat'); pg.fill('form[data-form=login] [name=password]', 'mudur-sifresi-1')
        pg.click('form[data-form=login] button[type=submit]'); expect(pg.locator('#app')).to_be_visible(timeout=20000); time.sleep(1.2)
        if pg.locator('form[data-form=kvkk]').count():
            pg.click('form[data-form=kvkk] .switch-ui'); pg.click('form[data-form=kvkk] button[type=submit]'); time.sleep(0.5)
        total = {}
        for path in PAGES:
            pg.goto(B+path); time.sleep(1.2)
            res = pg.evaluate("async () => { const r = await axe.run(document, {resultTypes:['violations']}); return r.violations.map(v => ({id:v.id, impact:v.impact, n:v.nodes.length, help:v.help})); }")
            print(path, json.dumps(res, ensure_ascii=False))
            det = pg.evaluate("""async () => { const r = await axe.run(document, {resultTypes:['violations']}); return r.violations.flatMap(v => v.nodes.slice(0,4).map(n => (v.id + ' :: ' + n.target.join(' ') + ' :: ' + (n.failureSummary||'').slice(0,160)))); }""")
            for d in det[:8]: print('  DETAY', d)
        b.close()
finally:
    srv.terminate()
