"""Browser regressions using Python's standard library and an isolated Chromium profile."""
import base64
import functools
import http.server
import json
import os
from pathlib import Path
import shutil
import socket
import struct
import subprocess
import tempfile
import threading
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def browser_binary():
    candidates = [os.environ.get("BROWSER_PATH")]
    for folder in (os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")):
        if folder:
            candidates.extend(str(Path(folder) / name) for name in (
                "BraveSoftware/Brave-Browser/Application/brave.exe",
                "Google/Chrome/Application/chrome.exe",
                "Microsoft/Edge/Application/msedge.exe",
            ))
    candidates.extend(shutil.which(name) for name in ("chromium", "chromium-browser", "google-chrome", "brave-browser", "msedge"))
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise RuntimeError("Install Chrome, Brave or Edge, or set BROWSER_PATH to its executable.")


class CDP:
    def __init__(self, port):
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5) as response:
            tab = next(item for item in json.load(response) if item["type"] == "page")
        endpoint = urllib.parse.urlsplit(tab["webSocketDebuggerUrl"])
        self.socket = socket.create_connection((endpoint.hostname, endpoint.port), timeout=15)
        key = base64.b64encode(os.urandom(16)).decode()
        self.socket.sendall((f"GET {endpoint.path} HTTP/1.1\r\nHost: {endpoint.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        headers = b""
        while not headers.endswith(b"\r\n\r\n"):
            headers += self.read(1)
        if headers.split(b"\r\n", 1)[0].split()[1:2] != [b"101"]:
            raise RuntimeError("Browser debugging handshake failed.")
        self.serial = 0
        self.call("Page.enable")
        self.call("Page.addScriptToEvaluateOnNewDocument", {"source": "window.testErrors=[];addEventListener('error',e=>{if(e.message)testErrors.push(e.message);else if(e.target?.tagName==='SCRIPT')testErrors.push('Script load failed: '+new URL(e.target.src).pathname)},true);addEventListener('unhandledrejection',e=>testErrors.push(String(e.reason?.message||e.reason)));"})

    def read(self, count):
        data = b""
        while len(data) < count:
            part = self.socket.recv(count - len(data))
            if not part:
                raise RuntimeError("Browser debugging connection closed.")
            data += part
        return data

    def call(self, method, params=None):
        self.serial += 1
        request_id = self.serial
        payload = json.dumps({"id": request_id, "method": method, "params": params or {}}).encode()
        size = len(payload)
        header = bytes([128 | size]) if size < 126 else b"\xfe" + struct.pack("!H", size) if size < 65536 else b"\xff" + struct.pack("!Q", size)
        mask = os.urandom(4)
        self.socket.sendall(b"\x81" + header + mask + bytes(value ^ mask[i % 4] for i, value in enumerate(payload)))
        while True:
            opcode, size = self.read(2)
            size &= 127
            if size == 126:
                size = struct.unpack("!H", self.read(2))[0]
            elif size == 127:
                size = struct.unpack("!Q", self.read(8))[0]
            if opcode & 15 == 8:
                raise RuntimeError("Browser closed its debugging connection.")
            result = json.loads(self.read(size))
            if result.get("method") == "Input.dragIntercepted":
                self.drag_data = result["params"]["data"]
            if result.get("method") == "Page.javascriptDialogOpening":
                self.call("Page.handleJavaScriptDialog", {"accept": True})
            if result.get("id") == request_id:
                if "error" in result:
                    raise RuntimeError(result["error"])
                return result.get("result", {})

    def evaluate(self, expression):
        result = self.call("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
        if "exceptionDetails" in result:
            raise RuntimeError(result["exceptionDetails"])
        return result["result"].get("value")

    def wait(self, expression, timeout=12):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.evaluate("document.readyState==='complete'&&(" + expression + ")"):
                return
            time.sleep(0.05)
        raise AssertionError("Timed out: " + expression + " State: " + str(self.evaluate("({url:location.href,ready:document.readyState,errors:window.testErrors,store:typeof window.CollectionStore,body:document.body.innerText.slice(0,160)})")))

    def go(self, url, ready):
        before = self.evaluate('performance.timeOrigin')
        navigation = self.call("Page.navigate", {"url": url})
        if navigation.get('errorText'):
            raise RuntimeError('Browser navigation failed: ' + navigation['errorText'])
        # Reopening the same URL must not pass against the previous document.
        fresh = "performance.timeOrigin!==" + str(before) + "&&" if navigation.get('loaderId') else ""
        self.wait(fresh + "location.href===" + json.dumps(url) + "&&(" + ready + ")")

    def escape(self):
        for event in ("keyDown", "keyUp"):
            self.call("Input.dispatchKeyEvent", {"type": event, "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27})




def add_discover_record(cdp, save=False):
    cdp.evaluate("document.getElementById('add-to-collection').click()")
    cdp.wait("document.getElementById('inventory-dialog').open")
    cdp.evaluate("document.getElementById('inventory-apply').click()")
    if save:
        cdp.evaluate("document.getElementById('detail-collection-save').click()")
        cdp.wait("document.getElementById('detail-collection-save').hidden")


def check_collection_hierarchy(cdp, base, route):
    url = f"{base}/{route}?tab=collection"
    cdp.go(url, "!!window.CollectionStore&&!!document.getElementById('collection-add')")
    cdp.evaluate("""(()=>{localStorage.removeItem('pokedex.collection.v1');CollectionStore.save({records:CARDS.slice(0,2).map((c,i)=>({id:'hierarchy-'+i,kind:'owned',cardId:c.id||c.collectorNumber,finish:'unknown',quantity:i?1:2,condition:'unknown',grading:null,notes:'preserve this note',chase:false,tradeStatus:'keep'}))},null)})()""")
    cdp.go(url + '&hierarchy=1', "document.querySelectorAll('.collection-card-checkbox input').length===2&&document.getElementById('collection-save').disabled")
    assert cdp.evaluate("!document.getElementById('collection-select')&&document.getElementById('collection-selection-actions').hidden&&!!document.querySelector('.collection-add-tile')"), 'Keep the Add tile; reveal bulk actions only after selection'
    assert cdp.evaluate("['collection-add','collection-save','collection-undo','collection-redo'].every(id=>document.querySelector('.collection-save-actions').contains(document.getElementById(id)))"), 'Editing actions belong together'
    assert cdp.evaluate("document.getElementById('collection-save').textContent.includes('Saved')&&document.getElementById('inventory-results').textContent===''"), 'Saved state and quiet default results'
    assert cdp.evaluate("document.querySelector('.inventory-quantity').textContent==='×2'"), 'Copies use a compact artwork badge'
    cdp.evaluate("document.querySelector('.collection-card-checkbox input').focus()")
    for event in ('keyDown', 'keyUp'):
        cdp.call('Input.dispatchKeyEvent', {'type':event,'key':' ','code':'Space','windowsVirtualKeyCode':32})
    assert cdp.evaluate("document.getElementById('collection-selected-count').textContent==='1 selected'&&!document.getElementById('collection-selection-actions').hidden&&document.activeElement.matches('.collection-card-checkbox input')"), 'Space selects and retains checkbox focus after rendering'
    cdp.evaluate("document.querySelectorAll('#collection-list .inventory-card')[1].click()")
    assert cdp.evaluate("document.querySelectorAll('.inventory-row.is-selected').length===2&&!document.getElementById('inventory-dialog').open&&document.getElementById('collection-save').disabled"), 'Selection does not edit or save collection data'
    cdp.evaluate("document.getElementById('collection-edit-selected').click();document.getElementById('collection-bulk-purpose').value='trade';document.getElementById('collection-bulk-purpose').dispatchEvent(new Event('change'));document.querySelector('.collection-bulk-edit form').requestSubmit()")
    assert cdp.evaluate("document.querySelectorAll('.purpose-trade').length===2&&CollectionStore.read().document.records.every(r=>r.tradeStatus==='keep'&&r.notes==='preserve this note')"), 'Batch edit preserves saved originals until Save'
    cdp.evaluate("document.getElementById('collection-undo').click();document.getElementById('collection-selection-cancel').click()")
    assert cdp.evaluate("document.getElementById('collection-selection-actions').hidden&&document.activeElement.matches('.inventory-card')"), 'Clear selection returns focus to a card'
    cdp.evaluate("document.querySelector('#collection-list .inventory-card').click();document.getElementById('inventory-quantity').value=3;document.getElementById('inventory-apply').click()")
    assert cdp.evaluate("document.getElementById('collection-save').classList.contains('primary')&&!document.getElementById('collection-add').classList.contains('primary')&&CollectionStore.read().document.records[0].quantity===2"), 'Unsaved edits emphasize Save without autosaving'
    cdp.evaluate("document.getElementById('collection-undo').click()")
    assert cdp.evaluate("document.getElementById('collection-save').disabled&&document.getElementById('collection-save').textContent.includes('Saved')&&!document.getElementById('collection-redo').disabled"), 'Undo restores Saved state and enables Redo'
    cdp.evaluate("document.getElementById('collection-redo').click();document.getElementById('collection-save').click()")
    cdp.wait("document.getElementById('collection-save').disabled&&document.getElementById('collection-save').textContent.includes('Saved')")
    assert cdp.evaluate("CollectionStore.read().document.records[0].quantity===3&&CollectionStore.read().document.records[0].notes==='preserve this note'"), 'Manual Save persists the edited quantity and notes'
    cdp.go(url + '&reopen=1', "document.querySelectorAll('.collection-card-checkbox input').length===2&&document.getElementById('collection-save').disabled")
    assert cdp.evaluate("document.querySelector('.inventory-quantity').textContent==='×3'"), 'Saved edits survive reopening'
    cdp.evaluate("document.getElementById('inventory-trade-filter').value='keep';document.getElementById('inventory-trade-filter').dispatchEvent(new Event('change'))")
    assert cdp.evaluate("document.getElementById('collection-filter-summary').textContent==='Filters · 1'&&document.querySelectorAll('.collection-filter-chip').length===1&&document.getElementById('inventory-results').textContent==='2 matches'"), 'Applied filters remain understandable'
    cdp.evaluate("document.querySelector('.collection-filter-chip').click();document.querySelector('.collection-more>summary').click()")
    cdp.escape()
    assert cdp.evaluate("!document.querySelector('.collection-more').open&&document.activeElement.matches('.collection-more>summary')"), 'Icon menu supports Escape and restores focus'
    for width in (1440, 768, 440, 320):
        cdp.call('Emulation.setDeviceMetricsOverride', {'width':width,'height':900,'deviceScaleFactor':1,'mobile':False})
        assert cdp.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), f'Collection must not overflow at {width}px'
        assert cdp.evaluate("['collection-add','collection-save','collection-undo','collection-redo'].every(id=>{let b=document.getElementById(id).getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1})"), 'Header controls remain within the screen'
        if width == 320:
            cdp.wait("getComputedStyle(document.querySelector('.collection-card-checkbox')).opacity==='1'")
    cdp.call('Emulation.setDeviceMetricsOverride', {'width':1366,'height':768,'deviceScaleFactor':1,'mobile':False})
    assert cdp.evaluate('testErrors.length===0'), cdp.evaluate('testErrors')
    print('PASS:', route, 'collection hierarchy, preserved Add tile, keyboard/batch selection, manual Save/Undo/Redo/reopen, filters, menu and four screen sizes', flush=True)


def check_collection(cdp, base, route):
    check_collection_hierarchy(cdp, base, route)
    cdp.go(f"{base}/{route}?tab=collection", "!!(window.CollectionStore&&document.getElementById('collection-add'))")
    cdp.evaluate("""(()=>{localStorage.removeItem('pokedex.collection.v1');let c=CARDS[0],doc={records:Array.from({length:1100},(_,i)=>({id:'browser-'+i,kind:'owned',cardId:c.id||c.collectorNumber,finish:'unknown',quantity:1,condition:'unknown',grading:{company:'Other',grade:'Group '+i},notes:'x'.repeat(1900),chase:false,tradeStatus:'keep'}))};CollectionStore.save(doc,null)})()""")
    cdp.call("Page.reload")
    cdp.wait("document.querySelectorAll('#collection-list .inventory-card').length===1100")
    cdp.evaluate("""window.exportedBackup=null;window.originalCreateURL=URL.createObjectURL;URL.createObjectURL=blob=>{exportedBackup=blob;return originalCreateURL(blob)};document.getElementById('collection-download').click()""")
    assert cdp.evaluate("exportedBackup.size>2*1024*1024"), "Backup fixture must reproduce the former 2 MB limit"
    cdp.evaluate("CollectionStore.save({records:[]},CollectionStore.read().revision);document.getElementById('collection-reload').click()")
    cdp.wait("document.querySelectorAll('#collection-list .inventory-card').length===0")
    cdp.evaluate("(()=>{let dt=new DataTransfer();dt.items.add(new File([exportedBackup],'collection-backup.json',{type:'application/json'}));let input=document.getElementById('collection-import');input.files=dt.files;input.dispatchEvent(new Event('change'))})()")
    cdp.wait("document.getElementById('collection-confirm').open")
    assert cdp.evaluate("document.getElementById('collection-confirm-copy').textContent.includes('1100')"), "Import did not validate the exported records"
    cdp.evaluate("document.getElementById('collection-confirm-yes').click();document.getElementById('collection-save').click()")
    assert cdp.evaluate("CollectionStore.read().document.records.length===1100&&CollectionStore.read().document.records.every(r=>r.notes==='x'.repeat(1900))"), "Backup restoration changed records or notes"
    # Keep the record validators active even though the file-size allowance grew.
    cdp.evaluate("(()=>{let doc=CollectionStore.read().document;doc.records[0].quantity=0;let dt=new DataTransfer();dt.items.add(new File([JSON.stringify(doc)],'invalid.json',{type:'application/json'}));let input=document.getElementById('collection-import');input.files=dt.files;input.dispatchEvent(new Event('change'))})()")
    cdp.wait("document.getElementById('collection-message-text').textContent.includes('whole-number quantity')")
    assert cdp.evaluate("!document.getElementById('collection-confirm').open&&CollectionStore.read().document.records[0].quantity===1"), "Invalid backup changed saved records"
    assert cdp.evaluate("testErrors.length===0"), cdp.evaluate("testErrors")
    cdp.evaluate("URL.createObjectURL=originalCreateURL;localStorage.removeItem('pokedex.collection.v1')")
    print("PASS:", route, "actual >2 MB export/import/save round trip and invalid-record rejection", flush=True)








class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass








def check_discover_gallery(cdp, base, route):
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1920,'height':1080,'deviceScaleFactor':1,'mobile':False})
    cdp.go(base+'/'+route,"!!window.DiscoverCollection&&document.querySelectorAll('#card-grid > button').length===24")
    cdp.evaluate("localStorage.removeItem('pokedex.collection.v1')")
    cdp.call('Page.reload');time.sleep(.15)
    cdp.wait("document.querySelectorAll('#card-grid > button').length===24")
    assert cdp.evaluate("!document.getElementById('filters-panel').open"),'Filters should start compact on desktop as well as phones'
    cdp.evaluate("document.querySelector('[data-color=\"#5f9bc2\"]').click()")
    assert cdp.evaluate("document.getElementById('color-enabled').checked&&document.getElementById('sort-order').disabled&&document.querySelector('[data-color=\"#5f9bc2\"]').getAttribute('aria-pressed')==='true'&&new URL(location.href).searchParams.get('color')==='#5f9bc2'"),'Swatches must use real color ranking and URL state'
    assert cdp.evaluate("document.querySelector('#card-grid > button').dataset.cardId===DiscoverCatalogue.search(CARDS,{colorEnabled:true,color:'#5f9bc2'})[0].id"),'Swatch results must match the existing catalogue algorithm'
    cdp.evaluate("document.getElementById('filters-panel').open=true;document.getElementById('set-filter').value='sv03.5';document.getElementById('set-filter').dispatchEvent(new Event('change'));document.getElementById('card-query').value='Bulbasaur';document.getElementById('card-query').dispatchEvent(new Event('input'))")
    assert cdp.evaluate("document.querySelectorAll('#card-grid > button').length===2"),'Search, set and color ranking must combine'
    cdp.escape()
    assert cdp.evaluate("!document.getElementById('filters-panel').open&&document.activeElement===document.getElementById('filters-title')"),'Filter dismissal must restore keyboard focus'
    cdp.evaluate("document.getElementById('sets-tab').click();document.getElementById('set-query').value='151';document.getElementById('set-query').dispatchEvent(new Event('input'));document.querySelector('.set-tile').click()")
    assert cdp.evaluate("!document.getElementById('color-enabled').checked&&document.getElementById('set-filter').value==='sv03.5'&&document.getElementById('sort-order').value==='number'&&!document.getElementById('back-to-sets').hidden"),'Opening a set must reset external color controls and sort by card number'
    cdp.evaluate("document.getElementById('clear-filters').click();document.getElementById('next-results').click()")
    assert cdp.evaluate("new URL(location.href).searchParams.get('page')==='2'&&document.querySelectorAll('#card-grid > button').length===24"),'Pagination must survive the gallery layout'
    cdp.call('Page.reload');time.sleep(.15);cdp.wait("document.getElementById('page-status').textContent==='Page 2 of 3'")
    for width,height in ((1366,768),(1920,1080),(2560,1440),(768,1024),(390,844),(320,740)):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700})
        for theme in ('light','dark'):
            cdp.evaluate("document.documentElement.dataset.theme="+json.dumps(theme)+";document.getElementById('cards-tab').click()")
            time.sleep(.08)
            assert cdp.evaluate("document.documentElement.scrollWidth<=innerWidth"),(route,width,theme,'Discover horizontal overflow')
            assert cdp.evaluate("(()=>{let h=document.querySelector('.site-header .brand').getBoundingClientRect(),m=document.querySelector('.discover-main'),f=document.querySelector('.app-footer');let edge=n=>n.getBoundingClientRect().left+parseFloat(getComputedStyle(n).paddingLeft);return Math.abs(h.left-edge(m))<1&&Math.abs(h.left-edge(f))<1})()"),(route,width,'Navigation/content/footer must share gutters')
            assert cdp.evaluate("getComputedStyle(document.querySelector('.discover-card')).backgroundColor==='rgba(0, 0, 0, 0)'"),'Artwork tiles must not retain boxed backgrounds'
            cdp.evaluate("document.getElementById('filters-panel').open=true")
            assert cdp.evaluate("(()=>{let r=document.getElementById('filters-form').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.width>0})()"),(route,width,'Filter panel must fit the viewport')
            cdp.evaluate("document.getElementById('filters-panel').open=false;document.getElementById('sets-tab').click()")
            assert cdp.evaluate("document.documentElement.scrollWidth<=innerWidth&&document.querySelectorAll('.set-tile').length===6"),'Set directory must stay responsive'
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1366,'height':768,'deviceScaleFactor':1,'mobile':False})
    cdp.evaluate("document.getElementById('cards-tab').click();document.getElementById('clear-filters').click();document.getElementById('card-query').value='Bulbasaur';document.getElementById('card-query').dispatchEvent(new Event('input'));document.querySelector('#card-grid > button').click()")
    assert cdp.evaluate("document.getElementById('details-dialog').open&&!document.querySelector('.price-checker').open&&!!document.querySelector('#related-list > button')"),'Details should prioritize artwork/actions and preserve related printings'
    cdp.evaluate("document.querySelector('.price-checker').open=true;document.getElementById('card-condition').value='nm';document.getElementById('card-condition').dispatchEvent(new Event('change'))")
    assert cdp.evaluate("document.getElementById('price-value').textContent==='$12.50'&&document.getElementById('price-context').textContent.includes('Fictional')"),'Secondary price controls must retain truthful fictional examples'
    cdp.evaluate("document.getElementById('view-image').click();document.getElementById('zoomed-image').dispatchEvent(new Event('error'))")
    assert cdp.evaluate("document.getElementById('image-dialog').open&&document.getElementById('image-status').textContent.includes('unavailable')"),'Image viewer errors must stay usable'
    assert cdp.evaluate("document.getElementById('details-dialog').open"),'Parent details must remain open behind image viewer'
    cdp.escape();time.sleep(.1)
    assert cdp.evaluate("document.getElementById('details-dialog').open&&document.activeElement===document.getElementById('view-image')"),'Image dismissal must return to its detail action'
    add_discover_record(cdp)
    assert cdp.evaluate("!document.getElementById('detail-collection-save').hidden&&localStorage.getItem('pokedex.collection.v1')===null"),'Collection additions must remain unsaved until manual Save'
    cdp.evaluate("document.getElementById('detail-collection-undo').click()")
    assert cdp.evaluate("document.getElementById('detail-collection-save').hidden"),'Collection additions must still support Undo'
    add_discover_record(cdp, save=True)
    assert cdp.evaluate("!!CollectionStore.read()&&document.getElementById('detail-collection-save').hidden"),'Collection Save must persist the chosen card'
    cdp.evaluate("BinderStore.write(SAMPLE_BINDERS.slice(0,1).map(b=>({...b,revision:0})));document.getElementById('add-to-binder').click()")
    assert cdp.evaluate("document.getElementById('placement-dialog').open&&!document.getElementById('placement-confirm').disabled"),'Binder/page handoff must remain available'
    cdp.evaluate("document.getElementById('placement-confirm').click()")
    cdp.wait("window.EditorLayout&&document.querySelector('.selection-status')?.dataset.placing==='true'")
    assert cdp.evaluate("JSON.parse(decodeURIComponent(location.hash.slice(1))).placeCard==='001'"),'Handoff must retain the real printing identity'
    cdp.escape()
    assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    print('PASS:',route,'artwork gallery, combined search/filter/color/URL/pagination, set reset, shared shell, details/price/image errors, collection Undo/manual Save and binder handoff across six sizes/both themes',flush=True)


def check_workspace_shelf(cdp, base, route):
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1920,'height':1080,'deviceScaleFactor':1,'mobile':False})
    cdp.go(base+'/'+route,"!!window.BinderStore&&!!document.getElementById('create-binder')")
    cdp.evaluate("BinderStore.reset()")
    cdp.call('Page.reload');time.sleep(.2);cdp.wait("document.querySelectorAll('#binder-grid .binder-card').length===2")
    assert cdp.evaluate("document.querySelector('.workspace-tab-row').contains(document.getElementById('create-binder'))"),'Binder and collection primary actions must share the tab row'
    for width,height in ((1366,768),(1920,1080),(2560,1440),(768,1024),(390,844),(320,740)):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700})
        for theme in ('light','dark'):
            cdp.evaluate("document.documentElement.dataset.theme="+json.dumps(theme))
            assert cdp.evaluate("document.documentElement.scrollWidth<=innerWidth"),(route,width,'Shelf horizontal overflow')
            assert cdp.evaluate("(()=>{let h=document.querySelector('.site-header .brand').getBoundingClientRect(),m=document.querySelector('.workspace'),f=document.querySelector('.workspace-footer');let edge=n=>n.getBoundingClientRect().left+parseFloat(getComputedStyle(n).paddingLeft);return Math.abs(h.left-edge(m))<1&&Math.abs(h.left-edge(f))<1})()"),(route,width,'Workspace gutters must match')
            assert cdp.evaluate("['.binder-meta','.preview-disclosure','#limit-copy','.binder-card-actions a'].every(s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize)>=14)"),'Binder captions and actions must stay readable'
            assert cdp.evaluate("(()=>{let v=getComputedStyle(document.querySelector('.view-binder-action')),e=getComputedStyle(document.querySelector('.edit-binder-action'));return v.backgroundColor===e.backgroundColor&&v.color===e.color})()"),'View and Edit must use the same quiet shared action style'
            cdp.evaluate("document.querySelector('.card-menu').scrollIntoView({block:'center'});document.querySelector('.card-menu').open=true")
            time.sleep(.08)
            assert cdp.evaluate("(()=>{let r=document.querySelector('.card-menu[open] .menu-items').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),(route,width,'Binder menu must fit the viewport')
            cdp.escape()
            assert cdp.evaluate("document.activeElement===document.querySelector('.card-menu > summary')"),'Escape must return focus to the binder menu trigger'
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1366,'height':768,'deviceScaleFactor':1,'mobile':False})
    cdp.evaluate("document.querySelector('.card-menu').open=true;[...document.querySelectorAll('.card-menu .menu-items button')].find(b=>b.textContent==='Rename').click();document.getElementById('binder-name').value='A collection of favorites with a long readable binder title';document.getElementById('form-submit').click()")
    assert cdp.evaluate("BinderStore.read()[0].name.includes('long readable')&&document.querySelector('.open-button').title===BinderStore.read()[0].name"),'Rename must persist and expose the full title'
    cdp.evaluate("document.querySelector('.card-menu').open=true;[...document.querySelectorAll('.card-menu .menu-items button')].find(b=>b.textContent==='Duplicate').click()")
    assert cdp.evaluate("BinderStore.read().length===3&&document.getElementById('create-binder').disabled&&!document.getElementById('limit-notice').hidden"),'Duplication must preserve the three-binder limit'
    order=cdp.evaluate("BinderStore.read().map(b=>b.id)")
    cdp.evaluate("document.querySelector('.card-menu').open=true;[...document.querySelectorAll('.card-menu .menu-items button')].find(b=>b.textContent==='Move later').click()")
    assert cdp.evaluate("BinderStore.read().map(b=>b.id)")==[order[1],order[0],order[2]],'Shelf reorder must save the existing order action'
    cdp.evaluate("document.getElementById('binder-search').value='not-a-real-binder';document.getElementById('binder-search').dispatchEvent(new Event('input'))")
    assert cdp.evaluate("!document.getElementById('no-results').hidden"),'Binder search empty state must remain available'
    cdp.evaluate("document.getElementById('clear-search').click();document.querySelectorAll('.card-menu')[2].open=true;[...document.querySelectorAll('.card-menu')[2].querySelectorAll('button')].find(b=>b.textContent==='Delete').click()")
    assert cdp.evaluate("document.getElementById('delete-dialog').open&&BinderStore.read().length===3"),'Delete must still require confirmation'
    cdp.evaluate("document.getElementById('confirm-delete').click()")
    cdp.wait("!document.getElementById('delete-dialog').open&&!document.getElementById('create-binder').disabled")
    cdp.evaluate("document.getElementById('create-binder').click();document.getElementById('binder-name').value='Fresh binder';document.getElementById('binder-rows').value=2;document.getElementById('binder-columns').value=4;document.getElementById('form-submit').click()")
    cdp.wait("!document.getElementById('edit-dialog').open")
    assert cdp.evaluate("(()=>{let b=BinderStore.read().at(-1);return b.name==='Fresh binder'&&b.pages===1&&b.rows===2&&b.columns===4})()"),'Creation must keep its real layout fields and local save'
    assert cdp.evaluate("[...document.querySelectorAll('.binder-card')].every(n=>n.querySelector('.view-binder-action').href.includes('binder=')&&n.querySelector('.edit-binder-action').hash)"),'Read-only View and editable destinations must stay distinct'
    cdp.evaluate("document.getElementById('collection-tab').click()")
    assert cdp.evaluate("document.getElementById('create-binder').getClientRects().length===0&&document.getElementById('collection-add').getClientRects().length>0"),'Only the active Workspace tab should expose its primary action'
    cdp.evaluate("document.getElementById('binders-tab').click()")
    assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    print('PASS:',route,'consistent shell/captions/actions, bounded menus and Escape focus, create/rename/duplicate/delete/reorder, limits and Workspace tab actions at six sizes/both themes',flush=True)




def check_cleanup(cdp, base, editor, workspace):
    preview = editor.startswith('preview/')
    discover = 'preview/Pokedex-discover.html' if preview else 'src/discover.html'
    landing = 'preview/Pokedex-landing-page.html' if preview else 'src/index.html'
    viewer = 'preview/Pokedex-viewer.html' if preview else 'src/viewer.html'
    cdp.call('Emulation.setDeviceMetricsOverride', {'width':1366,'height':768,'deviceScaleFactor':1,'mobile':False})
    cdp.go(base+'/'+workspace, "!!window.BinderStore&&!!document.querySelector('.binder-card')")
    # A clear() event uses key=null, unlike removeItem(). Clean views reload; dirty views retain edits.
    cdp.evaluate("BinderStore.reset();const latest=CollectionStore.read();CollectionStore.save({records:[]},latest?.revision??null);dispatchEvent(new StorageEvent('storage',{key:'pokedex.collection.v1'}));BinderStore.write(BinderStore.read().slice(0,1));dispatchEvent(new StorageEvent('storage',{key:'pokedex.workspace.v1'}))")
    assert cdp.evaluate("document.getElementById('owned-total').textContent==='0'&&document.querySelectorAll('.binder-card').length===1")
    cdp.evaluate("localStorage.clear();dispatchEvent(new StorageEvent('storage',{key:null}))")
    expected = cdp.evaluate("SAMPLE_COLLECTION.records.filter(r=>r.kind==='owned').reduce((n,r)=>n+r.quantity,0)")
    assert cdp.evaluate("Number(document.getElementById('owned-total').textContent)")==expected, 'Storage clear must refresh a clean collection'
    assert cdp.evaluate("document.querySelectorAll('.binder-card').length===2"), 'Storage clear must refresh the binder shelf'
    cdp.evaluate("document.getElementById('collection-tab').click();document.querySelector('#collection-list .inventory-card').click();document.getElementById('inventory-delete').click()")
    assert cdp.evaluate("document.getElementById('inventory-dialog').open&&document.getElementById('collection-confirm').open")
    cdp.escape()
    time.sleep(.1)
    assert cdp.evaluate("document.getElementById('inventory-dialog').open&&!document.getElementById('collection-confirm').open"), 'Escape should dismiss removal confirmation without closing the editable record'
    cdp.evaluate("document.getElementById('inventory-dialog').close()")
    cdp.evaluate("document.getElementById('collection-tab').click();document.querySelector('#collection-list .inventory-card').click();document.getElementById('inventory-quantity').valueAsNumber+=1;document.getElementById('inventory-apply').click();localStorage.clear();dispatchEvent(new StorageEvent('storage',{key:null}))")
    assert cdp.evaluate("Number(document.getElementById('owned-total').textContent)")==expected+1, 'Storage clear must preserve unsaved collection edits'
    assert cdp.evaluate("document.getElementById('collection-message-text').textContent.includes('another tab')")
    cdp.evaluate("document.getElementById('collection-toast-undo').click();document.getElementById('binders-tab').click();document.querySelector('.card-menu').open=true;[...document.querySelectorAll('.card-menu button')].find(b=>b.textContent==='Rename').click();BinderStore.write([]);document.getElementById('binder-name').value='Removed in another tab';document.getElementById('form-submit').click();document.getElementById('form-submit').click()")
    assert cdp.evaluate("document.getElementById('edit-dialog').open&&document.getElementById('form-error').textContent.includes('no longer available')&&BinderStore.read().length===0"), 'A deleted binder must not report a successful rename'
    cdp.evaluate("document.getElementById('edit-dialog').close()")
    bad_seed = urllib.parse.quote(json.dumps({'id':'invalid binder id','name':'Safe link','rows':1,'columns':1,'pages':1,'cards':['166']}))
    cdp.go(base+'/'+editor+'#'+bad_seed, "window.EditorLayout&&!document.documentElement.classList.contains('editor-loading')")
    cdp.evaluate("document.getElementById('save').click()")
    assert cdp.evaluate("BinderStore.read().length===1&&BinderSchema.validIdentifier(BinderStore.read()[0].id)"), 'Invalid link IDs must be replaced before saving'
    saved_id = cdp.evaluate('BinderStore.read()[0].id')
    cdp.go(base+'/'+discover, "!!window.DiscoverCollection&&document.querySelectorAll('#card-grid > button').length===24")
    cdp.evaluate("document.querySelector('#card-grid > button').click()")
    add_discover_record(cdp, save=True)
    cdp.evaluate("localStorage.removeItem('pokedex.collection.v1');dispatchEvent(new StorageEvent('storage',{key:null}))")
    add_discover_record(cdp, save=True)
    assert cdp.evaluate("document.getElementById('detail-message').textContent.includes('Collection saved')"), 'Discover must reset its revision after storage clear'
    add_discover_record(cdp)
    cdp.evaluate("localStorage.removeItem('pokedex.collection.v1');dispatchEvent(new StorageEvent('storage',{key:null}))")
    assert cdp.evaluate("!document.getElementById('detail-collection-save').hidden&&document.getElementById('detail-message').textContent.includes('another tab')"), 'Discover must retain dirty edits on storage clear'
    cdp.evaluate("document.getElementById('detail-collection-undo').click();document.getElementById('close-details').click()")
    cdp.go(base+'/'+viewer+'?binder='+saved_id, "!!document.querySelector('#viewer-cover-art .binder-cover-art')")
    cdp.evaluate("document.getElementById('viewer-open').click();document.getElementById('viewer-spread').click()")
    assert cdp.evaluate("document.querySelectorAll('.viewer-sheet').length===2"), 'Viewer must preserve its blank facing leaf'
    cdp.evaluate("document.querySelector('button.viewer-pocket').click()")
    assert cdp.evaluate("document.getElementById('viewer-inspect').open")
    cdp.escape()
    cdp.wait("!document.getElementById('viewer-inspect').open&&!!document.activeElement.dataset.viewerRegion")
    assert cdp.evaluate("!document.getElementById('viewer-inspect').open&&!!document.activeElement.dataset.viewerRegion"), 'Viewer inspection must return focus'
    for width,height in ((1366,768),(1920,1080),(2560,1440),(390,844)):
        cdp.call('Emulation.setDeviceMetricsOverride', {'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700})
        for theme in ('light','dark'):
            cdp.evaluate('document.documentElement.dataset.theme='+json.dumps(theme))
            assert cdp.evaluate('document.documentElement.scrollWidth<=innerWidth'), (viewer,width,theme,'Viewer overflow')
    cdp.evaluate("localStorage.clear();dispatchEvent(new StorageEvent('storage',{key:null}))")
    assert cdp.evaluate("!document.getElementById('viewer-error').hidden"), 'Deleted saved binder must disappear from the viewer'
    cdp.go(base+'/'+landing, "!!window.DemoMotion&&document.querySelectorAll('.arrange-summary').length===4")
    cdp.call('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
    for width,height in ((1366,768),(1920,1080),(2560,1440),(390,844)):
        cdp.call('Emulation.setDeviceMetricsOverride', {'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700})
        for theme in ('light','dark'):
            cdp.evaluate('document.documentElement.dataset.theme='+json.dumps(theme))
            time.sleep(.08)
            assert cdp.evaluate('document.documentElement.scrollWidth<=innerWidth'), (landing,width,theme,'Landing overflow')
    assert cdp.evaluate("!document.querySelector('.demo-playback')"), 'Retired playback buttons must not return'
    cdp.evaluate("document.querySelectorAll('.arrange-summary').forEach(n=>n.click())")
    assert cdp.evaluate('testErrors.length===0'), cdp.evaluate('testErrors')
    cdp.call('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'no-preference'}]})
    cdp.evaluate("document.getElementById('arrange').scrollIntoView();document.querySelector('.arrange-summary').click()")
    time.sleep(.6)
    assert cdp.evaluate('testErrors.length===0'), cdp.evaluate('testErrors')
    print('PASS:', 'preview' if preview else 'source', 'storage-clear clean/dirty behavior, stale rename, safe editor link, Discover revision reset, viewer navigation/inspection/storage, landing responsive/demo lifecycle', flush=True)






def check_push_insert(cdp, base, route):
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1920,'height':1080,'deviceScaleFactor':1,'mobile':False})
    seed=urllib.parse.quote(json.dumps({'name':'Push insertion','rows':2,'columns':3,'pages':2,'cards':['166','167','168','169']}))
    for direction,gap in ((1,False),(-1,False),(1,True),(-1,True)):
        cdp.go(base+'/'+route+'?push#'+seed,"window.EditorLayout&&!document.documentElement.classList.contains('editor-loading')")
        cdp.evaluate("BinderStore.write([]);document.getElementById('save').click()")
        if gap:
            book=cdp.evaluate("(()=>{let b=BinderStore.read()[0];b.document.pages[0].regions[1].content=null;BinderStore.save(b.id,b.document,b.revision);return b.id})()")
            cdp.go(base+'/'+route+'?push-gap#'+urllib.parse.quote(json.dumps({'id':book})),"window.EditorLayout&&!document.documentElement.classList.contains('editor-loading')")
        cdp.evaluate("EditorLayout.setCards(true)")
        time.sleep(.2)
        index=0 if direction==1 else 2
        points=cdp.evaluate("(()=>{let s=document.querySelector('#card-results .catalogue-card').getBoundingClientRect(),r=document.querySelectorAll('.editor-pocket')["+str(index)+"].getBoundingClientRect();return [{x:s.x+s.width/2,y:s.y+s.height/2},{x:r.x+r.width*"+('.1' if direction==1 else '.9')+",y:r.y+r.height/2}]})()")
        incoming=cdp.evaluate("document.querySelector('#card-results .catalogue-card').dataset.focusKey.slice('catalogue:'.length)")
        before=cdp.evaluate("JSON.stringify(BinderStore.read()[0].document)")
        cdp.drag_data=None;cdp.call('Input.setInterceptDrags',{'enabled':True})
        try:
            cdp.call('Input.dispatchMouseEvent',{'type':'mouseMoved',**points[0]})
            cdp.call('Input.dispatchMouseEvent',{'type':'mousePressed',**points[0],'button':'left','buttons':1,'clickCount':1})
            for step in range(1,9):
                cdp.call('Input.dispatchMouseEvent',{'type':'mouseMoved','x':points[0]['x']+(points[1]['x']-points[0]['x'])*step/8,'y':points[0]['y']+(points[1]['y']-points[0]['y'])*step/8,'button':'left','buttons':1})
                time.sleep(.03)
            cdp.evaluate('true');assert cdp.drag_data,'Catalogue card must initiate native dragging'
            for event in ('dragEnter','dragOver'):
                cdp.call('Input.dispatchDragEvent',{'type':event,**points[1],'data':cdp.drag_data})
            assert cdp.evaluate("document.querySelectorAll('.is-insert-path').length")== (2 if gap else 3),'Drop preview must stop at the first gap'
            assert cdp.evaluate("document.querySelectorAll('.is-insert-overflow').length")== (0 if gap else 1),'Preview must identify only the ejected end card'
            assert cdp.evaluate("document.getElementById('save').disabled&&JSON.stringify(BinderStore.read()[0].document)=== "+json.dumps(before)), 'Preview must not save or dirty the document'
            cdp.call('Input.dispatchDragEvent',{'type':'drop',**points[1],'data':cdp.drag_data})
            cdp.call('Input.dispatchMouseEvent',{'type':'mouseReleased',**points[1],'button':'left','clickCount':1})
        finally:cdp.call('Input.setInterceptDrags',{'enabled':False})
        assert cdp.evaluate("!document.getElementById('save').disabled&&!document.getElementById('feedback-undo').hidden&&!document.querySelector('.is-insert-path')"), ('Insertion must have Undo and clear its preview', cdp.evaluate("({saved:document.getElementById('save').disabled,undoHidden:document.getElementById('feedback-undo').hidden,paths:document.querySelectorAll('.is-insert-path').length,message:document.getElementById('editor-message').textContent})"))
        cdp.evaluate("document.getElementById('feedback-undo').click()")
        assert cdp.evaluate("document.getElementById('save').disabled"),'One Undo must restore the whole prior row'
        cdp.evaluate("document.getElementById('redo').click();document.getElementById('save').click()")
        book=cdp.evaluate("BinderStore.read()[0]")
        row=[r['content']['cardId'] if r['content'] else None for r in book['document']['pages'][0]['regions'][:3]]
        expected=[incoming,'166','168' if gap else '167'] if direction==1 else ['166' if gap else '167','168',incoming]
        assert row==expected,(route,direction,gap,row,expected)
        assert len(book['document']['overflow'])==(0 if gap else 1)
        cdp.go(base+'/'+route+'?push-reload#'+urllib.parse.quote(json.dumps({'id':book['id']})),"window.EditorLayout&&!document.documentElement.classList.contains('editor-loading')")
        assert cdp.evaluate("document.getElementById('save').disabled"),'Push must survive manual Save and reload'
    cdp.evaluate("EditorLayout.setCards(true);document.querySelector('#card-results .catalogue-card').click();document.getElementById('insert-left').focus()")
    cdp.call('Input.dispatchKeyEvent',{'type':'keyDown','key':'Enter','code':'Enter','windowsVirtualKeyCode':13,'text':'\r'})
    cdp.call('Input.dispatchKeyEvent',{'type':'keyUp','key':'Enter','code':'Enter','windowsVirtualKeyCode':13})
    assert cdp.evaluate("document.getElementById('insert-left').getAttribute('aria-pressed')==='true'"),'Keyboard must select the push direction'
    cdp.evaluate("document.querySelectorAll('.editor-pocket')[2].focus()")
    cdp.call('Input.dispatchKeyEvent',{'type':'keyDown','key':'Enter','code':'Enter','windowsVirtualKeyCode':13,'text':'\r'})
    cdp.call('Input.dispatchKeyEvent',{'type':'keyUp','key':'Enter','code':'Enter','windowsVirtualKeyCode':13})
    assert cdp.evaluate("!document.getElementById('save').disabled&&document.getElementById('insert-actions').hidden"),'Keyboard placement must commit the insertion'
    for width in (1366,1920,2560,390,320):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':844 if width<700 else 1080,'deviceScaleFactor':1,'mobile':width<700})
        cdp.evaluate("EditorLayout.setCards(true);document.querySelector('#card-results .catalogue-card').click()")
        time.sleep(.2)
        assert cdp.evaluate("(()=>{let b=document.getElementById('insert-right').getBoundingClientRect();return b.width>=40&&b.height>=40&&b.left>=0&&b.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth})()"),'Insertion controls must remain usable across sizes'
        cdp.escape()
    assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    print('PASS:',route,'native directional insert/gap preview, full-row Overflow, atomic Undo/Redo, manual Save/reload, keyboard insertion and responsive controls',flush=True)








def check_feature_parity(cdp, base, route):
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1920,'height':1080,'deviceScaleFactor':1,'mobile':False})
    seed=urllib.parse.quote(json.dumps({'name':'Copy source','rows':1,'columns':3,'pages':1,'cards':['166','167']}))
    ready="window.EditorLayout&&window.EditorArrange&&!document.documentElement.classList.contains('editor-loading')"
    cdp.go(base+'/'+route+'?parity#'+seed,ready)
    source=cdp.evaluate("(()=>{BinderStore.write([]);document.getElementById('save').click();let b=BinderStore.read()[0];b.document.frames={sleeve:'master',toploader:'clear'};b.document.pages[0].regions[0].content.variant='holo';BinderStore.save(b.id,b.document,b.revision);BinderStore.save('copy-target',BinderState.create({name:'Copy destination',rows:1,columns:2,cards:['168']}).document,null);return b.id})()")
    cdp.go(base+'/'+route+'?parity-source#'+urllib.parse.quote(json.dumps({'id':source})),ready)
    cdp.evaluate("document.querySelectorAll('.editor-pocket')[0].click();document.querySelectorAll('.editor-pocket')[1].click();document.getElementById('swap-selected-cards').click()")
    assert cdp.evaluate("!document.getElementById('save').disabled&&!document.getElementById('feedback-undo').hidden"),'Swap must be an explicit undoable draft edit'
    cdp.evaluate("document.getElementById('feedback-undo').click()")
    assert cdp.evaluate("document.getElementById('save').disabled"),'One Undo must restore the saved card positions'
    cdp.evaluate("document.getElementById('redo').click();document.getElementById('save').click()")
    assert cdp.evaluate("BinderStore.read().find(b=>b.id==="+json.dumps(source)+").document.pages[0].regions.map(r=>r.content?.cardId||null)")==['167','166',None]
    cdp.evaluate("EditorLayout.setCards(true);document.getElementById('picker-select-cards').click();document.querySelectorAll('#card-results .catalogue-card')[0].click();document.querySelectorAll('#card-results .catalogue-card')[1].click();document.getElementById('card-search').value='Squirtle';document.getElementById('card-search').dispatchEvent(new Event('input'))")
    assert cdp.evaluate("document.getElementById('picker-add-selected').textContent==='Add 2 cards'"),'Picker selection must survive search/filter changes'
    cdp.evaluate("document.querySelector('#card-results .catalogue-card').focus()")
    for kind in ('keyDown','keyUp'):
        cdp.call('Input.dispatchKeyEvent',{'type':kind,'key':'Enter','code':'Enter','windowsVirtualKeyCode':13,'text':'\r' if kind=='keyDown' else ''})
    assert cdp.evaluate("document.querySelector('#card-results .catalogue-card').getAttribute('aria-pressed')==='true'&&document.getElementById('picker-add-selected').textContent==='Add 3 cards'"),'Keyboard selection must toggle the tile and update its count'
    cdp.evaluate("document.getElementById('picker-add-selected').click();document.getElementById('save').click()")
    doc=cdp.evaluate("BinderStore.read().find(b=>b.id==="+json.dumps(source)+").document")
    assert len(doc['pages'])==2 and [r['content']['cardId'] for r in doc['pages'][0]['regions']]==['167','166','001'],'Batch insertion must preserve occupied pockets and fill the first gap'
    assert [r['content']['cardId'] for r in doc['pages'][1]['regions'] if r['content']]==['004','007'],'Batch insertion must create pages as needed'
    cdp.evaluate("document.getElementById('undo').click();document.getElementById('redo').click();document.getElementById('save').click();document.getElementById('clear-selection').click();document.querySelectorAll('.editor-pocket')[0].click();document.querySelectorAll('.editor-pocket')[1].click();document.getElementById('copy-cards-binder').click();document.getElementById('copy-destination').value='copy-target';document.getElementById('open-copy-destination').click()")
    cdp.wait("window.EditorArrange&&document.getElementById('binder-title').textContent==='Copy destination'&&!document.getElementById('cards-drawer').hidden&&!document.getElementById('paste-copied-cards').hidden")
    assert cdp.evaluate("document.getElementById('save').disabled&&BinderStore.read().find(b=>b.id==='copy-target').document.pages.length===1"),'Opening a copy destination must not automatically edit or save it'
    assert cdp.evaluate("JSON.stringify(BinderStore.read().find(b=>b.id==="+json.dumps(source)+").document)=== "+json.dumps(json.dumps(doc,separators=(',',':')))), 'Copy must leave the saved source unchanged'
    cdp.evaluate("document.getElementById('paste-copied-cards').click()")
    assert cdp.evaluate("!document.getElementById('save').disabled&&document.getElementById('paste-copied-cards').hidden&&sessionStorage.getItem('pokedex.copied-cards.v1')===null"),'Paste must create an unsaved undoable edit and consume the handoff'
    cdp.evaluate("document.querySelector('.editor-pocket.has-content').click();document.getElementById('copy-cards-binder').click();document.getElementById('copy-destination').value="+json.dumps(source)+";document.getElementById('open-copy-destination').click()")
    cdp.wait("document.getElementById('leave-dialog').open")
    assert cdp.evaluate("document.getElementById('binder-title').textContent==='Copy destination'"),'Copy navigation must preserve the unsaved-changes warning'
    cdp.evaluate("document.getElementById('leave-cancel').click();sessionStorage.removeItem('pokedex.copied-cards.v1')")
    cdp.evaluate("document.getElementById('undo').click()")
    assert cdp.evaluate("document.getElementById('save').disabled"),'One Undo must remove the entire copied batch'
    cdp.evaluate("document.getElementById('redo').click();document.getElementById('save').click()")
    copied=cdp.evaluate("BinderStore.read().find(b=>b.id==='copy-target').document")
    assert copied['pages'][0]['regions'][0]['content']['cardId']=='168','Destination cards must remain in place'
    pasted=[copied['pages'][0]['regions'][1]['content'],copied['pages'][1]['regions'][0]['content']]
    assert [c['cardId'] for c in pasted]==['167','166'] and all(c['frames']=={'sleeve':'master','toploader':'clear'} for c in pasted),'Copy must preserve effective source sleeves/toploaders'
    assert pasted[1]['variant']=='holo','Copy must preserve finishes'
    cdp.go(base+'/'+route+'?parity-reload#'+urllib.parse.quote(json.dumps({'id':'copy-target'})),ready)
    assert cdp.evaluate("document.getElementById('save').disabled"),'Copied cards must persist after manual Save/reload'
    for w,h in ((1366,768),(1920,1080),(2560,1440),(390,844),(320,740)):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':w,'height':h,'deviceScaleFactor':1,'mobile':w<700})
        cdp.evaluate("EditorLayout.setCards(true);document.getElementById('picker-select-cards').click()")
        time.sleep(.15)
        assert cdp.evaluate("document.documentElement.scrollWidth<=innerWidth&&document.getElementById('picker-add-selected').getBoundingClientRect().height>=40"),'Batch controls must fit desktop/phone layouts'
        assert cdp.evaluate("(()=>{let n=document.getElementById('cards-close'),r=n.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#cards-close')===n})()"),'The Cards drawer must stay above the Pages sidebar on narrow screens'
        cdp.evaluate("document.getElementById('picker-select-cards').click()")
    assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    landing='src/index.html' if route.startswith('src/') else 'preview/Pokedex-landing-page.html'
    cdp.go(base+'/'+landing,"document.querySelectorAll('.discover-card').length===4")
    cdp.call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
    for w,h,minimum in ((1366,768,105),(1920,1080,140),(2560,1440,140),(390,844,90)):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':w,'height':h,'deviceScaleFactor':1,'mobile':w<700})
        cdp.evaluate("document.getElementById('discover').scrollIntoView()")
        time.sleep(.15)
        assert cdp.evaluate("document.querySelector('.discover-card img').getBoundingClientRect().width")>=minimum,(landing,w,'Landing cards must be moderately larger')
        assert cdp.evaluate('document.documentElement.scrollWidth<=innerWidth'),(landing,w,'Landing overflow')
    assert cdp.evaluate("document.querySelectorAll('.arrange-summary')[3].textContent.includes('Coming soon')&&!document.getElementById('future-arrange').textContent.includes('Select several cards')&&!document.getElementById('future-arrange').textContent.includes('See all binder pages')"),'Landing roadmap must distinguish available and planned tools'
    cdp.call('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'no-preference'}]})
    print('PASS:',route,'Swap/Undo, filtered keyboard multi-select, batch insertion/pages, cross-binder handoff/manual Save/reload with style preservation, responsive controls and larger accurate landing demos',flush=True)


def check_workshop(cdp, base, route):
    ready="window.EditorLayout&&window.EditorArrange&&!document.documentElement.classList.contains('editor-loading')"
    def click(selector):
        time.sleep(.08)
        point=cdp.evaluate("(()=>{let n=document.querySelector("+json.dumps(selector)+");n.scrollIntoView({block:'nearest',inline:'nearest'});let r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
        for event in ('mousePressed','mouseReleased'):
            cdp.call('Input.dispatchMouseEvent',{'type':event,**point,'button':'left','clickCount':1})
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1920,'height':1080,'deviceScaleFactor':1,'mobile':False})
    seed=urllib.parse.quote(json.dumps({'name':'Icon workshop','rows':3,'columns':3,'pages':3,'cards':['166','167','168']}))
    cdp.go(base+'/'+route+'?icons#'+seed,ready)
    book=cdp.evaluate("(()=>{BinderStore.write([]);document.getElementById('save').click();let b=BinderStore.read()[0];b.document.pages[1].regions[0].content={id:crypto.randomUUID(),cardId:'001'};BinderStore.save(b.id,b.document,b.revision);return b.id})()")
    cdp.go(base+'/'+route+'?icons-saved#'+urllib.parse.quote(json.dumps({'id':book})),ready)
    cdp.evaluate('EditorLayout.setCards(false)')
    assert cdp.evaluate("!document.querySelector('.editor-more,.pocket-more,#zoom,#fit-page,#page-title,#page-summary')"),'Retired controls and metadata must be absent'
    assert cdp.evaluate("['download-backup','restore-backup','preview-binder','undo','redo'].every(id=>document.querySelector('.editor-rail').contains(document.getElementById(id)))&&!!document.querySelector('.editor-rail > .layout-settings')&&!!document.querySelector('.topbar-actions > #theme-toggle')"),'Direct tools must be in their requested locations'
    click('#theme-toggle')
    theme=cdp.evaluate('document.documentElement.dataset.theme')
    assert cdp.evaluate("document.getElementById('theme-toggle').getAttribute('aria-pressed')")==str(theme=='dark').lower()
    click('.editor-pocket:nth-child(1)');click('.editor-pocket:nth-child(2)')
    assert cdp.evaluate("document.querySelectorAll('.editor-pocket.is-selected').length===2&&document.querySelector('.editor-shell.has-selection')&&parseFloat(getComputedStyle(document.querySelectorAll('.editor-pocket')[2]).opacity)<.5"),'Ordinary clicks must accumulate visible selection and dim other cards'
    assert cdp.evaluate("!document.getElementById('merge').hidden===false&&document.getElementById('save').disabled"),'Ordinary card selection must not merge or edit cards'
    click('#select-pockets')
    assert cdp.evaluate("document.querySelectorAll('.editor-pocket.is-selected').length===2&&!document.getElementById('merge').hidden&&[...document.querySelectorAll('.editor-pocket')].every(n=>!n.draggable)"),'Entering merge mode must retain the selected cards and select pockets without dragging them'
    click('#merge');click('#confirm-yes')
    assert cdp.evaluate("document.querySelectorAll('.editor-pocket').length===8&&!document.getElementById('save').disabled"),'Merge mode must perform an undoable merge'
    click('#undo');click('#clear-selection')
    assert cdp.evaluate("document.querySelectorAll('.editor-pocket').length===9&&document.getElementById('save').disabled")
    click('#select-pockets')
    assert cdp.evaluate("document.getElementById('select-pockets').getAttribute('aria-pressed')==='true'"),'Merge mode must activate before selecting pockets'
    assert cdp.evaluate("getComputedStyle(document.getElementById('select-pockets')).boxShadow!=='none'"),'Merge mode must stay visibly active before selecting pockets'
    click('.editor-pocket:nth-child(7)');click('.editor-pocket:nth-child(8)')
    assert cdp.evaluate("document.querySelectorAll('.editor-pocket.is-selected').length===2&&!document.getElementById('merge').disabled"),cdp.evaluate("({selected:[...document.querySelectorAll('.editor-pocket.is-selected')].map(n=>n.getAttribute('aria-label')),mode:document.getElementById('select-pockets').getAttribute('aria-pressed'),reason:document.getElementById('merge').title})")
    click('#merge');click('#confirm-yes')
    assert cdp.evaluate("document.querySelectorAll('.editor-pocket').length===8"),'Empty pockets must merge as well as occupied pockets'
    click('#undo');click('#clear-selection');click('.editor-pocket:nth-child(1)');click('#pocket-content');click('#pocket-tab-placeholder')
    for width in (1920,390,320):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':1080 if width==1920 else 844,'deviceScaleFactor':1,'mobile':False})
        time.sleep(.15)
        assert cdp.evaluate("(()=>{let n=document.getElementById('pocket-tab-placeholder'),r=n.getBoundingClientRect(),text=document.createRange();text.selectNodeContents(n);let t=text.getBoundingClientRect();return t.left>=r.left&&t.right<=r.right&&n.scrollWidth<=n.clientWidth&&document.documentElement.scrollWidth<=innerWidth})()"),'Placeholder label must fit its tab at desktop and phone widths'
    click('#pocket-close')
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1920,'height':1080,'deviceScaleFactor':1,'mobile':False})
    time.sleep(.15)
    cdp.escape()
    click('.editor-pocket:nth-child(1)');click('#move-to-page');click('#move-confirm');click('.editor-pocket:nth-child(5)')
    assert cdp.evaluate("!document.querySelectorAll('.editor-pocket')[0].classList.contains('has-content')&&document.querySelectorAll('.editor-pocket')[4].classList.contains('has-content')"),'Move icon must offer a keyboard/click alternative on the current page'
    click('#undo');click('#clear-selection')
    click('.layout-settings > summary')
    assert cdp.evaluate("['page-rows','page-columns','page-view','layout-apply'].every(id=>{let n=document.getElementById(id);return n.getBoundingClientRect().height>=40&&parseFloat(getComputedStyle(n).borderLeftWidth)>=1})"),'Layout fields and actions must look like real controls'
    cdp.escape();click('#help-trigger')
    assert cdp.evaluate("document.getElementById('workshop-help').open&&document.activeElement.id==='help-search'")
    cdp.evaluate("document.getElementById('help-search').value='overflow';document.getElementById('help-search').dispatchEvent(new Event('input'))")
    assert cdp.evaluate("[...document.querySelectorAll('#help-guides details')].some(n=>!n.hidden)&&[...document.querySelectorAll('#help-guides details')].some(n=>n.hidden)")
    cdp.evaluate("document.getElementById('help-search').value='nonsense-qzz';document.getElementById('help-search').dispatchEvent(new Event('input'))")
    assert cdp.evaluate("!document.getElementById('help-empty').hidden")
    cdp.escape();cdp.wait("!document.getElementById('workshop-help').open")
    assert cdp.evaluate("document.activeElement.id==='help-trigger'"),'Help dismissal must restore focus'
    click('#customize-binder');click('[data-frame-style=master]');click('#next-page');click('.editor-pocket.has-content');click('#cover-apply');click('#save')
    assert cdp.evaluate("!document.querySelector('[data-frame-style=transparent]')"),'Transparent cover must not become an unsupported card frame'
    saved=cdp.evaluate('BinderStore.read()[0].document')
    assert saved['pages'][1]['regions'][0]['content']['frames']['sleeve']=='master','Turn pages during styling must preserve draft and target the new card'
    assert 'frames' not in saved['pages'][0]['regions'][0]['content'],'Styling target must leave other pages unchanged'
    click('#edit-cover-preview');click('[data-cover-theme=transparent]')
    assert cdp.evaluate("document.querySelector('#binder-page .cover-transparent image')!==null"),'Transparent preview must show first-page artwork'
    assert cdp.evaluate("document.getElementById('save').disabled"),'Cover preview must not commit'
    click('#cover-apply');click('#save')
    cdp.evaluate("window.exportedBackup=null;let create=URL.createObjectURL;URL.createObjectURL=b=>{exportedBackup=b;return create(b)};document.getElementById('download-backup').click()")
    assert cdp.evaluate("(async()=>JSON.parse(await exportedBackup.text()).cover.theme==='transparent')()"),'Backup must include the transparent cover'
    cdp.evaluate("(()=>{let dt=new DataTransfer();dt.items.add(new File([exportedBackup],'backup.json',{type:'application/json'}));let n=document.getElementById('import-file');n.files=dt.files;n.dispatchEvent(new Event('change'))})()")
    cdp.wait("document.getElementById('confirm-dialog').open");click('#confirm-yes');click('#save')
    cdp.call('Page.reload');time.sleep(.3);cdp.wait(ready)
    assert cdp.evaluate('document.documentElement.dataset.theme')==theme
    assert cdp.evaluate("document.querySelector('#header-cover-art .cover-transparent image')!==null&&BinderStore.read()[0].document.cover.theme==='transparent'"),'Manual Save/restore/reload must preserve actual transparent artwork'
    workspace='src/workspace.html' if route.startswith('src/') else 'preview/Pokedex-workspace.html'
    viewer='src/viewer.html' if route.startswith('src/') else 'preview/Pokedex-viewer.html'
    cdp.go(base+'/'+workspace,"!!document.querySelector('.binder-card .cover-transparent image')")
    assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    cdp.go(base+'/'+viewer+'?binder='+book,"!!document.querySelector('#viewer-cover-art .cover-transparent image')")
    assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    cdp.go(base+'/'+route+'?icons-reloaded#'+urllib.parse.quote(json.dumps({'id':book})),ready)
    # Long-press touch movement is a real pointer sequence, not a synthetic click.
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':440,'height':956,'deviceScaleFactor':1,'mobile':True})
    cdp.call('Emulation.setTouchEmulationEnabled',{'enabled':True})
    cdp.evaluate("EditorLayout.setCards(false);document.getElementById('page-list').querySelector('.page-button').click();document.getElementById('clear-selection').click()")
    time.sleep(.2)
    pts=cdp.evaluate("[0,4].map(i=>{let r=document.querySelectorAll('.editor-pocket')[i].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})")
    cdp.call('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[pts[0]]});time.sleep(.3)
    cdp.call('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[pts[1]]});time.sleep(.1)
    cdp.call('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert cdp.evaluate("!document.querySelectorAll('.editor-pocket')[0].classList.contains('has-content')&&document.querySelectorAll('.editor-pocket')[4].classList.contains('has-content')"),'Touch hold and drag must move the existing card'
    cdp.evaluate("document.getElementById('undo').click()")
    cdp.call('Emulation.setTouchEmulationEnabled',{'enabled':False})
    for w,h in ((320,740),(390,844),(440,956),(844,390),(1366,768),(1920,1080)):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':w,'height':h,'deviceScaleFactor':1,'mobile':w<=700})
        time.sleep(.15)
        assert cdp.evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),(w,h,'page overflow')
        assert cdp.evaluate("(()=>{let r=document.getElementById('binder-page').getBoundingClientRect(),s=document.getElementById('canvas-stage').getBoundingClientRect();return r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1})()"),(w,h,'binder must fit automatically')
        assert cdp.evaluate("['previous-page','next-page'].every(id=>{let n=document.getElementById(id),r=n.getBoundingClientRect();return r.height>=40&&r.width>=40&&parseFloat(getComputedStyle(n).borderLeftWidth)>=1})"),'Page arrows need visible usable buttons'
        click('.layout-settings > summary');time.sleep(.1)
        assert cdp.evaluate("(()=>{let r=document.querySelector('.layout-settings-body').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),(w,h,'settings popup bounds')
        cdp.escape()
        cdp.evaluate('EditorLayout.setCards(true)');cdp.wait("!document.getElementById('cards-drawer').hidden&&document.getElementById('card-results').getBoundingClientRect().height>100")
        assert cdp.evaluate("document.getElementById('card-results').getBoundingClientRect().height>100&&['card-search','type-filter','set-filter'].every(id=>document.getElementById(id).getBoundingClientRect().height>=39.5)"),(w,h,'visible cards and controls',cdp.evaluate("['card-search','type-filter','set-filter'].map(id=>document.getElementById(id).getBoundingClientRect().height)"))
        cdp.wait("(()=>{let b=document.getElementById('binder-page').getBoundingClientRect(),s=document.getElementById('canvas-stage').getBoundingClientRect();return b.left>=s.left-1&&b.right<=s.right+1&&b.top>=s.top-1&&b.bottom<=s.bottom+1})()")
        cdp.evaluate('EditorLayout.setCards(false)')
    cdp.evaluate("if(document.getElementById('pages-toggle').getAttribute('aria-expanded')==='false')document.getElementById('pages-toggle').click();document.getElementById('add-page').click()")
    assert cdp.evaluate("document.querySelectorAll('.page-button').length===4&&document.getElementById('next-page').dataset.add==='true'"),'Add tile must create the next page'
    cdp.evaluate("document.getElementById('undo').click()");time.sleep(.15)
    cdp.evaluate("document.querySelector('.page-button').focus()")
    cdp.call('Input.dispatchKeyEvent',{'type':'keyDown','key':'ArrowDown','code':'ArrowDown','modifiers':1,'windowsVirtualKeyCode':40})
    cdp.call('Input.dispatchKeyEvent',{'type':'keyUp','key':'ArrowDown','code':'ArrowDown','modifiers':1,'windowsVirtualKeyCode':40})
    cdp.evaluate("document.getElementById('save').click()")
    assert cdp.evaluate("BinderStore.read()[0].document.pages[1].regions[0].content?.cardId==='166'"),('Keyboard page reordering must preserve the moved page',cdp.evaluate("({focus:document.activeElement.outerHTML.slice(0,160),pages:BinderStore.read()[0].document.pages.map(p=>p.regions[0].content?.cardId),errors:testErrors,message:document.getElementById('editor-message').textContent,dirty:!document.getElementById('save').disabled})"))
    assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    print('PASS:',route,'direct icon toolbar/theme, highlighted click selection/merge, Help/search/focus, styling page turns, transparent cover/backup/restore, real touch movement and responsive controls',flush=True)


def check_workshop_refinements(cdp, base, route):
    ready="window.EditorLayout&&!document.documentElement.classList.contains('editor-loading')"
    seed=urllib.parse.quote(json.dumps({'name':'Refinements','rows':3,'columns':3,'pages':4,'cards':['166','167','168']}))
    def click(selector):
        time.sleep(.1)
        p=cdp.evaluate("(()=>{let n=document.querySelector("+json.dumps(selector)+");n.scrollIntoView({block:'nearest',inline:'nearest'});let r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
        for event in ('mousePressed','mouseReleased'):
            cdp.call('Input.dispatchMouseEvent',{'type':event,**p,'button':'left','clickCount':1})
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1920,'height':1080,'deviceScaleFactor':1,'mobile':False})
    cdp.go(base+'/'+route+'?refinements#'+seed,ready)
    cdp.evaluate('EditorLayout.setCards(false)')
    # Cover -> style tab is the regression path that previously retained disabled arrows.
    for view in ('one','two'):
        cdp.evaluate("document.getElementById('page-view').value="+json.dumps(view)+";document.getElementById('page-view').dispatchEvent(new Event('change'));document.querySelector('.page-button').click()")
        click('#edit-cover-preview')
        assert cdp.evaluate("document.getElementById('next-page').disabled")
        for tab in ('sleeve','toploader'):
            click('#custom-tab-'+tab)
            assert cdp.evaluate("!document.getElementById('next-page').disabled"),'Switching from Cover must re-enable page turning'
            click('#next-page')
            assert cdp.evaluate("document.querySelector('.page-button[aria-current=page]').textContent")==('Page 2' if view=='one' else 'Page 3')
            click('#previous-page')
            assert cdp.evaluate("document.querySelector('.page-button[aria-current=page]').textContent")== 'Page 1'
        click('#cover-cancel')
    for width,height in ((440,956),(320,740)):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':True})
        for view in ('one','two'):
            cdp.evaluate("document.getElementById('page-view').value="+json.dumps(view)+";document.getElementById('page-view').dispatchEvent(new Event('change'));document.querySelector('.page-button').click()")
            click('#edit-cover-preview');click('#custom-tab-toploader');click('#next-page')
            assert cdp.evaluate("document.querySelector('.page-button[aria-current=page]').textContent")==('Page 2' if view=='one' else 'Page 3'),'Phone styling arrows must turn real pages'
            click('#previous-page');click('#cover-cancel')
    # Both open sides reserve space; the book stays centered for each page view.
    for width,height in ((1920,1080),(1366,768),(844,700)):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
        for view in ('one','two'):
            cdp.evaluate("document.getElementById('page-view').value="+json.dumps(view)+";document.getElementById('page-view').dispatchEvent(new Event('change'))")
            for side in ('expanded','collapsed'):
                cdp.evaluate("if((document.getElementById('pages-toggle').getAttribute('aria-expanded')==='true')!=="+str(side=='expanded').lower()+")document.getElementById('pages-toggle').click()")
                for tool,pane in (('#cards-tool','#cards-drawer'),('.layout-settings > summary','.layout-settings-body'),('#edit-cover-preview','#cover-customizer'),('#customize-binder','#cover-customizer')):
                    click(tool)
                    cdp.wait("(()=>{let p=document.querySelector("+json.dumps(pane)+").getBoundingClientRect(),c=document.querySelector('.canvas-panel').getBoundingClientRect();return p.width>0&&p.right<=c.left+1})()")
                    try:
                        cdp.wait("(()=>{let b=document.getElementById('binder-page').getBoundingClientRect(),c=document.getElementById('canvas-stage').getBoundingClientRect();return Math.abs(b.x+b.width/2-c.x-c.width/2)<2&&b.left>=c.left-1&&b.right<=c.right+1})()",timeout=3)
                    except AssertionError:
                        raise AssertionError((width,view,side,tool,cdp.evaluate("({book:document.getElementById('binder-page').getBoundingClientRect().toJSON(),stage:document.getElementById('canvas-stage').getBoundingClientRect().toJSON(),classes:document.querySelector('.editor-shell').className,tracks:getComputedStyle(document.querySelector('.editor-shell')).gridTemplateColumns,shell:document.querySelector('.editor-shell').getBoundingClientRect().toJSON(),canvas:getComputedStyle(document.querySelector('.canvas-panel')).gridColumn,pages:document.getElementById('pages-sidebar').getBoundingClientRect().toJSON()})")))
                    assert cdp.evaluate("(()=>{let b=document.getElementById('binder-page').getBoundingClientRect(),c=document.getElementById('canvas-stage').getBoundingClientRect();return Math.abs(b.x+b.width/2-c.x-c.width/2)<2&&b.left>=c.left-1&&b.right<=c.right+1})()"),(width,view,side,tool,'book centering',cdp.evaluate("({book:document.getElementById('binder-page').getBoundingClientRect().toJSON(),stage:document.getElementById('canvas-stage').getBoundingClientRect().toJSON(),scroll:document.getElementById('canvas-stage').scrollLeft})"))
                    if side=='expanded':
                        assert cdp.evaluate("document.querySelector('.canvas-panel').getBoundingClientRect().right<=document.getElementById('pages-sidebar').getBoundingClientRect().left+1")
                    if pane=='#cards-drawer': click('#cards-close')
                    elif pane=='#cover-customizer':click('#cover-cancel')
                    else:cdp.escape()
                if side=='collapsed':
                    assert cdp.evaluate("document.getElementById('pages-view').getAttribute('aria-pressed')==='false'&&document.getElementById('overflow-view').getAttribute('aria-pressed')==='false'"),'Collapsed sidebar must not retain selected icon styling'
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1920,'height':1080,'deviceScaleFactor':1,'mobile':False})
    cdp.evaluate("document.getElementById('page-view').value='one';document.getElementById('page-view').dispatchEvent(new Event('change'));document.querySelector('.page-button').click();document.getElementById('clear-selection').click()")
    assert cdp.evaluate("document.querySelectorAll('.editor-pocket.is-selected,.editor-sheet.is-active').length===0&&!document.querySelector('.editor-shell').classList.contains('has-selection')")
    assert cdp.evaluate("[...document.querySelectorAll('.empty-plus')].every(n=>parseFloat(getComputedStyle(n).opacity)>.3)")
    # A real native mouse drag between existing cards must swap, not displace.
    cdp.drag_data=None;cdp.call('Input.setInterceptDrags',{'enabled':True})
    pts=cdp.evaluate("[0,1].map(i=>{let r=document.querySelectorAll('.editor-pocket')[i].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})")
    try:
        cdp.call('Input.dispatchMouseEvent',{'type':'mouseMoved',**pts[0]})
        cdp.call('Input.dispatchMouseEvent',{'type':'mousePressed',**pts[0],'button':'left','buttons':1,'clickCount':1})
        for step in range(1,9):
            cdp.call('Input.dispatchMouseEvent',{'type':'mouseMoved','x':pts[0]['x']+(pts[1]['x']-pts[0]['x'])*step/8,'y':pts[0]['y'],'button':'left','buttons':1});time.sleep(.02)
        cdp.evaluate('true');assert cdp.drag_data
        for event in ('dragEnter','dragOver','drop'):
            cdp.call('Input.dispatchDragEvent',{'type':event,**pts[1],'data':cdp.drag_data})
        cdp.call('Input.dispatchMouseEvent',{'type':'mouseReleased',**pts[1],'button':'left','clickCount':1})
    finally: cdp.call('Input.setInterceptDrags',{'enabled':False})
    assert cdp.evaluate("document.getElementById('editor-message').textContent==='Cards swapped.'&&document.getElementById('editor-message').getBoundingClientRect().width>80"),'Toast must explain the edit in visible short text'
    cdp.evaluate("document.getElementById('save').click()")
    assert cdp.evaluate("BinderStore.read().find(b=>b.name==='Refinements').document.pages[0].regions.slice(0,2).map(r=>r.content.cardId)")==['167','166']
    assert cdp.evaluate("BinderStore.read().find(b=>b.name==='Refinements').document.overflow.length===0")
    # A moved toolbar must shrink naturally after a large selection becomes one empty pocket.
    cdp.evaluate("document.querySelectorAll('.editor-pocket')[0].click();document.querySelectorAll('.editor-pocket')[1].click()")
    cdp.evaluate("document.querySelector('.floating-handle').focus()")
    cdp.call('Input.dispatchKeyEvent',{'type':'keyDown','key':'ArrowRight','code':'ArrowRight','windowsVirtualKeyCode':39})
    cdp.evaluate("document.getElementById('clear-selection').click();document.querySelectorAll('.editor-pocket')[8].click()")
    time.sleep(.15)
    assert cdp.evaluate("(()=>{let n=document.querySelector('.selection-status'),buttons=[...n.querySelectorAll('button')].filter(n=>n.getClientRects().length);return n.getBoundingClientRect().width<=buttons.length*44+36})()"),'Few actions must not retain a dragged toolbar\'s old width'
    click('#selection-dismiss');cdp.evaluate("if(document.getElementById('pages-toggle').getAttribute('aria-expanded')==='false')document.getElementById('pages-toggle').click();window.addPageToast=null;document.getElementById('add-page').addEventListener('click',()=>{window.addPageToast={text:document.getElementById('editor-message').textContent,visible:!document.querySelector('.editor-feedback').hidden}},{once:true})");click('#add-page')
    cdp.call('Input.dispatchMouseEvent',{'type':'mouseMoved','x':10,'y':10})
    assert cdp.evaluate("addPageToast?.text==='Page added.'&&addPageToast.visible"), cdp.evaluate("({captured:addPageToast,message:document.getElementById('editor-message').textContent,hidden:document.querySelector('.editor-feedback').hidden})")
    time.sleep(3.2)
    assert cdp.evaluate("document.querySelector('.editor-feedback').hidden"),'Routine notifications must expire after three seconds'
    cdp.evaluate("document.getElementById('undo').click();document.getElementById('feedback-dismiss').click()")
    assert cdp.evaluate("document.querySelector('.editor-feedback').hidden")
    click('#edit-cover-preview')
    cdp.evaluate("document.getElementById('custom-cover-controls').open=true")
    assert cdp.evaluate("(()=>{let n=document.querySelector('#custom-cover-controls > summary'),s=getComputedStyle(n,'::after'),r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return s.backgroundImage==='none'&&r.left>=p.left&&r.right<=p.right&&parseFloat(getComputedStyle(n).paddingLeft)>=10})()"),'Artwork header must have one padded, bounded chevron'
    assert cdp.evaluate("[...document.querySelectorAll('.workshop-icon,.icon-button,.rail-button,.selection-icon,.sidebar-views button,.floating-handle')].filter(n=>n.getBoundingClientRect().width&&n.querySelector('svg.ui-symbol')?.getBoundingClientRect().width).every(n=>{let r=n.getBoundingClientRect(),s=n.querySelector('svg.ui-symbol').getBoundingClientRect();return Math.abs(r.x+r.width/2-s.x-s.width/2)<1&&Math.abs(r.y+r.height/2-s.y-s.height/2)<1})"),'Icon-only controls must center their visible SVG'
    click('#cover-cancel')
    assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    print('PASS:',route,'Cover-to-style navigation, both-page/both-sidebar centering, quiet collapsed state, empty pluses, native swap, shrinking draggable bars, three-second text toasts and artwork headers',flush=True)


def check_desktop_reliability(cdp, base, route):
    ready="window.EditorLayout&&window.UIControls&&!document.documentElement.classList.contains('editor-loading')"
    def go(seed, suffix=''):
        cdp.go(base+'/'+route+'?desktop-reliability'+suffix+'#'+urllib.parse.quote(json.dumps(seed)),ready)
    def click(selector):
        time.sleep(.08)
        point=cdp.evaluate("(()=>{let n=document.querySelector("+json.dumps(selector)+");n.scrollIntoView({block:'nearest',inline:'nearest'});let r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
        for event in ('mousePressed','mouseReleased'):
            cdp.call('Input.dispatchMouseEvent',{'type':event,**point,'button':'left','clickCount':1})
    def key(name, code, number, modifiers=0):
        for event in ('keyDown','keyUp'):
            cdp.call('Input.dispatchKeyEvent',{'type':event,'key':name,'code':code,'windowsVirtualKeyCode':number,'modifiers':modifiers})
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1000,'deviceScaleFactor':1,'mobile':False})
    go({'name':'Fixture setup','cards':[]})
    cdp.evaluate("BinderStore.write([{id:'reliable-source',name:'Source',pages:2,rows:2,columns:2,cards:['166'],revision:0},{id:'reliable-target',name:'Destination',pages:4,rows:2,columns:3,cards:['167','168'],revision:0}])")
    go({'id':'reliable-source'},'-source')
    click('.editor-pocket.has-content');click('#copy-cards-binder');click('#open-copy-destination')
    cdp.wait("document.getElementById('binder-title').textContent==='Destination'&&!!window.EditorLayout")
    assert cdp.evaluate("document.querySelectorAll('.page-button').length===4&&document.querySelectorAll('.editor-pocket').length===6&&document.querySelectorAll('.editor-pocket.has-content').length===2"),'Copying into a metadata-only binder must restore its existing layout and cards'
    cdp.evaluate('EditorLayout.setCards(true)')
    click('#paste-copied-cards');click('#save')
    saved=cdp.evaluate("BinderStore.read().find(b=>b.id==='reliable-target').document")
    assert saved['name']=='Destination' and len(saved['pages'])==4 and [r['content']['cardId'] for r in saved['pages'][0]['regions'] if r['content']]==['167','168','166'],'Paste and Save must preserve destination metadata and original cards'
    go({'id':'reliable-target'},'-reload')
    assert cdp.evaluate("document.querySelectorAll('.editor-pocket.has-content').length===3"),'Copied destination must survive reload'
    revision=cdp.evaluate("BinderStore.read().find(b=>b.id==='reliable-target').revision")
    key('s','KeyS',83,2)
    assert cdp.evaluate("BinderStore.read().find(b=>b.id==='reliable-target').revision")==revision,'Saving a clean binder must not increment its revision'
    cdp.evaluate("document.querySelector('.layout-settings > summary').focus()")
    key('ArrowDown','ArrowDown',40)
    assert cdp.evaluate("document.activeElement.id==='preview-binder'"),'Rail navigation must skip disabled Undo/Redo'
    key('End','End',35)
    assert cdp.evaluate("UIControls.canFocus(document.activeElement)&&document.activeElement.id!=='return-results'"),'End must skip hidden toolbar links'
    cdp.evaluate("[...document.querySelectorAll('.page-button')].at(-1).click();document.activeElement.blur()")
    count=cdp.evaluate("document.querySelectorAll('.page-button').length")
    key('ArrowRight','ArrowRight',39)
    assert cdp.evaluate("document.querySelectorAll('.page-button').length")==count,'ArrowRight on the last page must not create a page'
    click('#next-page')
    assert cdp.evaluate("document.querySelectorAll('.page-button').length")==count+1,'The visible plus button must still add a page'
    key('s','KeyS',83,2)
    assert cdp.evaluate("BinderStore.read().find(b=>b.id==='reliable-target').revision")==revision+1,'One shortcut must perform exactly one save'
    click('#next-page')
    cdp.evaluate("window.realSave=BinderStore.save;window.saveAttempts=0;BinderStore.save=()=>{saveAttempts++;throw Error('Save failed. Your draft remains available. Try again after freeing storage.')} ")
    key('s','KeyS',83,2)
    assert cdp.evaluate("saveAttempts===1&&!document.getElementById('save').disabled&&document.querySelector('.editor-feedback.is-error')&&document.getElementById('editor-message').textContent==='Save failed. Your draft remains available. Try again after freeing storage.'"),'Failed saves must attempt once, keep the draft and show the complete error'
    click('#edit-cover-preview');key('s','KeyS',83,2)
    assert cdp.evaluate("saveAttempts===1&&document.getElementById('save').disabled"),'A customization draft must block both Save and its shortcut'
    click('#cover-cancel')
    time.sleep(3.2)
    assert cdp.evaluate("!document.querySelector('.editor-feedback').hidden&&!!document.querySelector('.editor-feedback.is-error')"),'Errors must remain readable until dismissed'
    click('#feedback-dismiss')
    assert cdp.evaluate("document.querySelector('.editor-feedback').hidden"),'Errors must be dismissible'
    cdp.evaluate("BinderStore.save=realSave;document.getElementById('save').click();let b=BinderStore.read().find(b=>b.id==='reliable-target');b.document.pages[1].regions[0].content={id:crypto.randomUUID(),cardId:'001'};BinderStore.save(b.id,b.document,b.revision)")
    go({'id':'reliable-target'},'-styles')
    original_page=cdp.evaluate("BinderStore.read().find(b=>b.id==='reliable-target').document.pages[0]")
    click('.editor-pocket.has-content');click('#pocket-style');click('[data-frame-style=great]');click('#next-page')
    assert cdp.evaluate("document.getElementById('frame-scope').value==='page'&&!document.getElementById('frame-scope').selectedOptions[0].disabled"),'A lost card selection must fall back to the populated current page'
    click('#next-page')
    assert cdp.evaluate("document.getElementById('frame-scope').value===''&&document.getElementById('cover-apply').disabled&&document.querySelector('[data-frame-style=great]').getAttribute('aria-pressed')==='true'"),'An empty page must require an explicit scope without dropping the style draft or broadening it to the binder'
    click('#previous-page');click('#cover-apply');click('#save')
    styled=cdp.evaluate("BinderStore.read().find(b=>b.id==='reliable-target').document")
    assert styled['pages'][1]['regions'][0]['content']['frames']['sleeve']=='great' and styled['pages'][0]==original_page,'Only the newly chosen page must receive the style'
    click('#previous-page');click('.editor-pocket:nth-child(4)');click('#pocket-content');click('#pocket-tab-placeholder');click('#pocket-apply')
    cdp.wait("!document.getElementById('pocket-dialog').open&&document.activeElement.classList.contains('editor-pocket')")
    assert cdp.evaluate("!document.getElementById('feedback-undo').hidden&&document.getElementById('editor-message').textContent==='Pocket design applied.'"),'Pocket design must use shared edit tracking, toast Undo and visible focus restoration'
    click('#feedback-undo')
    assert cdp.evaluate("!document.querySelectorAll('.editor-pocket')[3].classList.contains('has-content')"),'Toast Undo must restore the pocket before applying its placeholder'
    click('.editor-pocket.has-content');click('#move-to-page');cdp.escape()
    cdp.wait("!document.getElementById('move-dialog').open&&document.activeElement!==document.body")
    cdp.escape()
    click('#select-pockets');click('.editor-pocket:nth-child(1)');click('.editor-pocket:nth-child(2)');click('#merge');click('#confirm-yes')
    cdp.wait("!document.getElementById('confirm-dialog').open&&document.activeElement.classList.contains('editor-pocket')")
    workspace=cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")
    cdp.go(base+'/'+route+'?desktop-reliability-missing#'+urllib.parse.quote(json.dumps({'id':'missing-binder'})),"!!document.getElementById('editor-load-error')")
    assert cdp.evaluate("document.getElementById('save').disabled&&!document.querySelector('.editor-pocket')&&document.querySelector('.editor-feedback').hidden&&document.getElementById('theme-toggle').hidden&&testErrors.length===0"),'Unknown IDs must show a persistent error without an editable blank replacement or uninitialized controls'
    assert cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")==workspace,'Missing-binder errors must not modify saved storage'
    cdp.evaluate("localStorage.setItem('pokedex.workspace.v1','broken-json')")
    cdp.go(base+'/'+route+'?desktop-reliability-corrupt',"!!document.getElementById('editor-load-error')")
    assert cdp.evaluate("document.getElementById('save').disabled&&localStorage.getItem('pokedex.workspace.v1')==='broken-json'&&testErrors.length===0"),'Unreadable storage must remain untouched and block saving'
    cdp.evaluate("localStorage.setItem('pokedex.workspace.v1',"+json.dumps(workspace)+")")
    discover='src/discover.html' if route.startswith('src/') else 'preview/Pokedex-discover.html'
    cdp.go(base+'/'+discover,"window.DiscoverCollection&&window.UIControls&&!!document.querySelector('#card-grid button')")
    click('#card-grid button')
    cdp.evaluate("DiscoverCollection.open(CARDS[0])")
    assert cdp.evaluate("document.getElementById('inventory-status').selectedIndex===0&&document.getElementById('inventory-status').selectedOptions[0].textContent==='Optional'"),'Discover must have a matching initial status option'
    cdp.escape();cdp.wait("!document.getElementById('inventory-dialog').open")
    cdp.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    click('#card-grid button');click('#add-to-binder')
    cdp.wait("document.getElementById('placement-dialog').open&&document.activeElement.id==='target-binder'")
    time.sleep(.15)
    assert cdp.evaluate("document.getElementById('placement-dialog').contains(document.activeElement)"),'Closing details must not steal focus from the new placement dialog'
    click('#placement-cancel');cdp.wait("document.getElementById('details-dialog').open&&document.activeElement.id==='add-to-binder'")
    click('#close-details');cdp.wait("!document.querySelector('dialog[open]')&&document.activeElement.matches('#card-grid button')")
    assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    print('PASS:',route,'Desktop reliability: metadata-only copy/Save/reload, guarded saves/failures, safe styling scopes, keyboard navigation, dialog focus, pocket-design Undo, full persistent errors and Discover status',flush=True)


def check_phone_layout(cdp, base, route):
    ready="window.EditorLayout&&!document.documentElement.classList.contains('editor-loading')"
    seed=urllib.parse.quote(json.dumps({'name':'Phone layout','rows':3,'columns':3,'pages':4,'cards':['166','167','168']}))
    def click(selector):
        p=cdp.evaluate("(()=>{let n=document.querySelector("+json.dumps(selector)+");n.scrollIntoView({block:'nearest',inline:'center'});let r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:n.contains(document.elementFromPoint(x,y))}})()")
        assert p.pop('hit'),(selector,'Control covered or outside viewport')
        for event in ('mousePressed','mouseReleased'):
            cdp.call('Input.dispatchMouseEvent',{'type':event,**p,'button':'left','clickCount':1})
        time.sleep(.2)
    def bounds(selector):
        return cdp.evaluate("(()=>{let r=document.querySelector("+json.dumps(selector)+").getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()")
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    cdp.go(base+'/'+route+'?mobile-layout#'+seed,ready)
    workspace=cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")
    cdp.evaluate("localStorage.removeItem('pokedex.workspace.v1')")
    for width,height in ((320,640),(390,844),(440,956),(844,390),(956,440)):
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':True})
        time.sleep(.15)
        assert cdp.evaluate("getComputedStyle(document.querySelector('.editor-rail')).position==='fixed'&&document.getElementById('pages-toggle').parentElement.classList.contains('editor-rail')"),'Landscape must keep phone tools, not desktop sidebars'
        for theme in ('light','dark'):
            cdp.evaluate("document.documentElement.dataset.theme="+json.dumps(theme))
            click('#cards-tool')
            assert bounds('#cards-drawer') and bounds('.editor-rail'),(width,height,'Cards bounds')
            assert cdp.evaluate("document.getElementById('card-results').clientHeight>=160"),'Cards need a useful scrolling artwork area'
            if height>500:
                assert cdp.evaluate("document.getElementById('binder-page').getBoundingClientRect().height>=90"),'Opening Cards must retain a useful preview'
                before=cdp.evaluate("document.getElementById('cards-drawer').clientHeight")
                click('#cards-drawer .sheet-size')
                assert cdp.evaluate("document.getElementById('cards-drawer').clientHeight")>before,'Expand must increase sheet space'
                click('#cards-drawer .sheet-size')
            click('#cards-close')
            click('#customize-binder')
            assert bounds('#cover-customizer') and bounds('.customizer-actions'),(width,height,'Customizer actions bounds')
            assert cdp.evaluate("document.querySelector('.customizer-design-body').clientHeight>=60"),(width,height,'Styling presets must remain usable',cdp.evaluate("document.querySelector('.customizer-design-body').clientHeight"))
            if height>500:
                click('#cover-customizer .sheet-size')
                assert bounds('.customizer-actions')
                click('#cover-customizer .sheet-size')
            click('#next-page');click('#previous-page')
            click('#pick-style-card')
            assert cdp.evaluate("document.getElementById('cover-customizer').hidden"),'Target picker must uncover the binder'
            click('.editor-pocket.has-content')
            cdp.wait("!document.getElementById('cover-customizer').hidden&&document.getElementById('frame-scope').value==='selection'")
            click('#cover-cancel')
            click('#pages-toggle')
            assert bounds('#pages-sidebar'),(width,height,cdp.evaluate("document.getElementById('pages-sidebar').getBoundingClientRect().toJSON()"))
            click('#overflow-view')
            assert cdp.evaluate("!document.getElementById('sidebar-overflow').hidden&&document.getElementById('page-list').closest('[hidden]')!==null"),'Pages and Overflow must stay separate views'
            click('#pages-toggle')
            click('.layout-settings > summary')
            assert bounds('.layout-settings-body')
            cdp.escape()
    # Real touchscreen tap-to-place and viewport shrink/restore, without changing storage.
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    cdp.call('Emulation.setTouchEmulationEnabled',{'enabled':True})
    click('#cards-tool')
    for selector in ('.catalogue-card','.editor-pocket:nth-child(4)'):
        p=cdp.evaluate("(()=>{let n=document.querySelector("+json.dumps(selector)+");n.scrollIntoView({block:'nearest'});let r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
        cdp.call('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[p]})
        cdp.call('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        time.sleep(.15)
    assert cdp.evaluate("document.getElementById('cards-drawer').hidden&&document.querySelectorAll('.editor-pocket')[3].classList.contains('has-content')"),'Tap a card then a pocket must place it'
    cdp.call('Emulation.setTouchEmulationEnabled',{'enabled':False})
    click('#undo');click('#cards-tool')
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':390,'height':420,'deviceScaleFactor':1,'mobile':True})
    time.sleep(.15)
    assert bounds('#cards-drawer') and bounds('.editor-rail'),'Controls must follow a reduced visual viewport'
    click('#cards-close')
    cdp.call('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
    time.sleep(.15)
    click('#save')
    binder=cdp.evaluate("BinderStore.read()[0].id")
    preview=route.startswith('preview/')
    pages=[('preview/Pokedex-landing-page.html' if preview else 'src/index.html',"!!document.querySelector('.hero')"),('preview/Pokedex-workspace.html' if preview else 'src/workspace.html',"!!window.BinderStore"),('preview/Pokedex-discover.html' if preview else 'src/discover.html',"!!document.querySelector('#card-grid button')"), (('preview/Pokedex-viewer.html' if preview else 'src/viewer.html')+'?binder='+binder,"!!document.querySelector('#viewer-cover-art .binder-cover-art')")]
    for page,loaded in pages:
        cdp.go(base+'/'+page,loaded)
        for width,height in ((320,640),(390,844),(844,390)):
            cdp.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':True})
            time.sleep(.15)
            assert cdp.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+1&&innerWidth<=document.documentElement.clientWidth+1"),(page,width,'Page causes horizontal overflow or automatic scaling')
        assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
    cdp.evaluate("localStorage.setItem('pokedex.workspace.v1',"+json.dumps(workspace)+")" if workspace is not None else "localStorage.removeItem('pokedex.workspace.v1')")
    print('PASS:',route,'phone/landscape sheets, expansion, reachable styling/page controls, separate sidebar views, touchscreen placement, viewport resize and all-page horizontal bounds',flush=True)


def check_cloud_contract(cdp, base, workspace, editor):
    fixture=(ROOT/'scripts/fixtures/backend-browser.js').read_text(encoding='utf-8')
    injection=cdp.call('Page.addScriptToEvaluateOnNewDocument',{'source':fixture})['identifier']
    try:
        cdp.call('Emulation.setDeviceMetricsOverride',{'width':1366,'height':768,'deviceScaleFactor':1,'mobile':False})
        cdp.go(base+'/'+workspace,"window.BinderRepository?.user&&document.querySelector('#limit-copy')?.textContent==='0 of 3 binders'")
        original=cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")
        cdp.evaluate("document.getElementById('create-binder').click();document.getElementById('binder-name').value='Cloud UI test';document.getElementById('form-submit').click()")
        cdp.wait("document.querySelectorAll('#binder-grid .binder-card').length===1&&!document.getElementById('edit-dialog').open")
        assert cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")==original,'Cloud create must leave local binders untouched'
        cdp.evaluate("document.querySelector('.edit-binder-action').click()")
        cdp.wait("window.EditorLayout&&document.getElementById('binder-title').textContent==='Cloud UI test'")
        cdp.evaluate("document.getElementById('rename-binder').click();document.getElementById('new-name').value='Saved cloud title';document.getElementById('name-form').requestSubmit();document.getElementById('save').click()")
        cdp.wait("document.getElementById('save').disabled&&!document.getElementById('save').hasAttribute('aria-busy')")
        assert cdp.evaluate("JSON.parse(sessionStorage.getItem('pokedex.test-cloud'))[0].document.name==='Saved cloud title'"),'Cloud Save must use the repository'
        previous_origin=cdp.evaluate('performance.timeOrigin')
        cdp.call('Page.reload');cdp.wait("performance.timeOrigin!=="+str(previous_origin)+"&&window.EditorLayout&&document.getElementById('binder-title').textContent==='Saved cloud title'")
        cdp.evaluate("let rows=JSON.parse(sessionStorage.getItem('pokedex.test-cloud'));rows[0].revision++;rows[0].document.name='Other device';sessionStorage.setItem('pokedex.test-cloud',JSON.stringify(rows));document.getElementById('rename-binder').click();document.getElementById('new-name').value='My conflicting draft';document.getElementById('name-form').requestSubmit();document.getElementById('save').click()")
        cdp.wait("document.getElementById('cloud-save-conflict')?.open")
        assert cdp.evaluate("(()=>{const r=document.getElementById('cloud-save-conflict').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"),'Cloud conflict controls must fit the viewport'
        screenshots=ROOT/'.scratch/screenshots';screenshots.mkdir(parents=True,exist_ok=True)
        shot=cdp.call('Page.captureScreenshot',{'format':'png'})['data']
        (screenshots/('cloud-conflict-'+('source' if editor.startswith('src/') else 'preview')+'.png')).write_bytes(base64.b64decode(shot))
        assert cdp.evaluate("document.getElementById('binder-title').textContent==='My conflicting draft'"),'Conflict must preserve the draft'
        cdp.evaluate("[...document.querySelectorAll('#cloud-save-conflict button')].find(b=>b.textContent==='Save as copy').click()")
        cdp.wait("!document.getElementById('cloud-save-conflict').open&&JSON.parse(sessionStorage.getItem('pokedex.test-cloud')).length===2")
        assert cdp.evaluate("document.getElementById('binder-title').textContent==='My conflicting draft (copy)'"),'Save as copy must retarget the editor'
        assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
        print('PASS:',editor,'simulated cloud UI contract: async bootstrap, create, manual Save/reload, conflict draft preservation, Save as copy and local isolation',flush=True)
    finally:
        cdp.call('Page.removeScriptToEvaluateOnNewDocument',{'identifier':injection})
        cdp.go(base+'/'+workspace,"!!window.BinderStore&&!!document.querySelector('#create-binder')")
        cdp.evaluate("sessionStorage.removeItem('pokedex.test-cloud')")


def main():
    binary = browser_binary()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietServer, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    cdp = None
    scratch = ROOT / '.scratch'
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="pokedex-browser-check-", dir=scratch) as profile:
        process = subprocess.Popen([binary, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--blink-settings=imagesEnabled=false", "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            deadline = time.monotonic() + 15
            active_port = Path(profile) / "DevToolsActivePort"
            while True:
                try:
                    port = int(active_port.read_text().splitlines()[0])
                    break
                except (OSError, IndexError, ValueError):
                    if process.poll() is not None or time.monotonic() >= deadline:
                        raise RuntimeError("Could not start the isolated headless browser.")
                    time.sleep(0.05)
            cdp = CDP(port)
            # Frontend regressions must stay local even when the developer has
            # configured real services. The cloud contract replaces this fixture.
            cdp.call('Page.addScriptToEvaluateOnNewDocument',{'source':"Object.defineProperty(window,'POKEDEX_BACKEND',{configurable:true,get:()=>({}),set(){}});"})
            cdp.call("Emulation.setDeviceMetricsOverride", {"width": 1366, "height": 768, "deviceScaleFactor": 1, "mobile": False})
            base = f"http://127.0.0.1:{server.server_port}"
            for editor, workspace in (("src/editor.html", "src/workspace.html"), ("preview/Pokedex-editor.html", "preview/Pokedex-workspace.html")):
                if os.environ.get('POKEDEX_BROWSER_SUITE') == 'cloud':
                    check_cloud_contract(cdp, base, workspace, editor)
                    continue
                if os.environ.get('POKEDEX_BROWSER_SUITE') == 'collection':
                    check_collection(cdp, base, workspace)
                    check_discover_gallery(cdp, base, 'src/discover.html' if editor.startswith('src/') else 'preview/Pokedex-discover.html')
                    check_cleanup(cdp, base, editor, workspace)
                    check_cloud_contract(cdp, base, workspace, editor)
                    continue
                check_phone_layout(cdp, base, editor)
                check_desktop_reliability(cdp, base, editor)
                cdp.call('Emulation.setDeviceMetricsOverride',{'width':1366,'height':768,'deviceScaleFactor':1,'mobile':False})
                check_workshop_refinements(cdp, base, editor)
                check_workshop(cdp, base, editor)
                check_collection(cdp, base, workspace)
                check_push_insert(cdp, base, editor)
                check_feature_parity(cdp, base, editor)
                check_discover_gallery(cdp, base, "src/discover.html" if editor.startswith("src/") else "preview/Pokedex-discover.html")
                check_workspace_shelf(cdp, base, workspace)
                check_cleanup(cdp, base, editor, workspace)
                check_cloud_contract(cdp, base, workspace, editor)
        finally:
            if cdp:
                try:
                    cdp.call("Browser.close")
                except (OSError, RuntimeError):
                    pass
                cdp.socket.close()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            server.shutdown()


if __name__ == "__main__":
    main()
