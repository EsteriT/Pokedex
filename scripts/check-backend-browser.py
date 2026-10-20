"""Real local Supabase browser acceptance using disposable test-account sessions.

The Node live-test runner owns the accounts, private fixture and cleanup. Google
consent still requires the user's normal browser; no Google password is needed here.
"""
import base64
import functools
import http.server
import importlib.util
import json
import subprocess
import sys
import tempfile
import threading
import time
from check_collection_cloud import check_collection_cloud
from check_account_cloud import check_account_cloud
from check_catalogue_cloud import check_catalogue_cloud
from pathlib import Path
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('browser_checks', ROOT/'scripts/check-browser.py')
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


def main():
    fixture = Path(sys.argv[1]).resolve()
    if not fixture.is_relative_to(ROOT/'.scratch'):
        raise RuntimeError('Session fixtures must stay inside ignored .scratch storage.')
    config = json.loads(fixture.read_text(encoding='utf-8'))
    if urlsplit(config['url']).hostname not in ('localhost', '127.0.0.1'):
        raise RuntimeError('Browser acceptance is restricted to local Supabase.')
    server = http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(checks.QuietServer,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base = 'http://127.0.0.1:'+str(server.server_port)
    cdp = None
    injection = None
    key = 'sb-'+urlsplit(config['url']).hostname.split('.')[0]+'-auth-token'
    with tempfile.TemporaryDirectory(prefix='backend-browser-',dir=ROOT/'.scratch') as profile:
        process = subprocess.Popen([checks.browser_binary(),'--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--blink-settings=imagesEnabled=false','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        try:
            deadline = time.monotonic()+20
            while not (Path(profile)/'DevToolsActivePort').exists():
                if process.poll() is not None or time.monotonic()>deadline:
                    raise RuntimeError('Could not start isolated browser.')
                time.sleep(.1)
            cdp = checks.CDP(int((Path(profile)/'DevToolsActivePort').read_text().splitlines()[0]))
            cdp.call('Emulation.setDeviceMetricsOverride',{'width':1366,'height':900,'deviceScaleFactor':1,'mobile':False})

            def auth(session):
                nonlocal injection
                if injection:
                    cdp.call('Page.removeScriptToEvaluateOnNewDocument',{'identifier':injection})
                public = json.dumps({'url':config['url'],'publishableKey':config['publicKey']})
                source = "Object.defineProperty(window,'POKEDEX_BACKEND',{get:()=>("+public+"),set(){}});"
                source += "if(sessionStorage.getItem('pokedex.live-user')!=="+json.dumps(session['user']['id'])+"){localStorage.setItem("+json.dumps(key)+","+json.dumps(json.dumps(session))+");sessionStorage.setItem('pokedex.live-user',"+json.dumps(session['user']['id'])+");}"
                injection = cdp.call('Page.addScriptToEvaluateOnNewDocument',{'source':source})['identifier']

            def workspace(route):
                cdp.go(base+'/'+route,"!!window.BinderRepository?.user&&document.querySelector('#binder-grid')?.getAttribute('aria-busy')==='false'")

            def saved():
                cdp.wait("!document.getElementById('save').hasAttribute('aria-busy')&&document.getElementById('save').disabled",timeout=35)

            def reload_editor(title):
                before = cdp.evaluate('performance.timeOrigin')
                cdp.call('Page.reload')
                cdp.wait("performance.timeOrigin!=="+str(before)+"&&!!window.EditorLayout&&document.getElementById('binder-title').textContent==="+json.dumps(title),timeout=35)

            for index, (folder, workspace_name, editor_name, viewer_name) in enumerate([
                ('src/','workspace.html','editor.html','viewer.html'),
                ('preview/','Pokedex-workspace.html','Pokedex-editor.html','Pokedex-viewer.html'),
            ]):
                owner_session, other_session = config['sessions'][index*2:index*2+2]
                auth(owner_session)
                workspace(folder+workspace_name)
                check_catalogue_cloud(cdp, base, folder, workspace_name, editor_name, viewer_name)
                workspace(folder+workspace_name)
                cdp.evaluate("(async()=>{const c=BinderRepository.client,r=await c.from('binders').select('*');if(r.error)throw Error(r.error.message);const result=await c.rpc('commit_binders',{expected:r.data.map(b=>({id:b.id,revision:b.revision})),documents:[]});if(result.error)throw Error(result.error.message)})()")
                cdp.evaluate("(()=>{const d=BinderState.create({name:'Local original',rows:2,columns:2,cards:['001']}).document;BinderStore.write([{id:crypto.randomUUID(),revision:1,name:d.name,pages:1,rows:2,columns:2,cards:['001'],document:d}]);if(!localStorage.getItem('pokedex.collection.v1'))CollectionStore.save({records:[]},null)})()")
                original = cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")
                collection = cdp.evaluate("localStorage.getItem('pokedex.collection.v1')")
                workspace(folder+workspace_name+'?acceptance=1')
                cdp.evaluate("document.getElementById('create-binder').click();document.getElementById('binder-name').value='Live browser binder';document.getElementById('binder-rows').value=2;document.getElementById('binder-columns').value=2;document.getElementById('form-submit').click()")
                cdp.wait("document.querySelectorAll('#binder-grid .binder-card').length===1&&!document.getElementById('edit-dialog').open",timeout=35)
                cdp.evaluate("document.querySelector('.edit-binder-action').click()")
                cdp.wait("!!window.EditorLayout&&document.getElementById('binder-title').textContent==='Live browser binder'&&document.querySelectorAll('#card-results .catalogue-card').length===24",timeout=35)
                cdp.evaluate("EditorLayout.setCards(true);document.querySelector('#card-results .catalogue-card').click();document.querySelector('#binder-page .editor-pocket').click();document.getElementById('save').click()")
                saved()
                reload_editor('Live browser binder')
                assert cdp.evaluate("(async()=>{const r=await BinderRepository.client.from('binders').select('*');return !!r.data[0].document.pages[0].regions[0].content?.cardId})()"),'Manual card placement must persist through real Save/reload'
                # Restore a portable document containing real, browser-encoded artwork.
                cdp.evaluate("(async()=>{const r=await BinderRepository.client.from('binders').select('*');window.liveDoc=structuredClone(r.data[0].document);const canvas=document.createElement('canvas');canvas.width=canvas.height=2;canvas.getContext('2d').fillRect(0,0,2,2);window.liveArt=canvas.toDataURL('image/png');liveDoc.pages[0].regions[1].content={id:crypto.randomUUID(),kind:'artwork',src:liveArt,name:'Acceptance image',width:2,height:2,fit:'contain',zoom:1,x:50,y:50};const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(liveDoc)],'backup.json',{type:'application/json'}));const input=document.getElementById('import-file');input.files=dt.files;input.dispatchEvent(new Event('change'));})()")
                cdp.wait("document.getElementById('confirm-dialog').open")
                cdp.evaluate("document.getElementById('confirm-yes').click();document.getElementById('save').click()")
                saved()
                owner_path = cdp.evaluate("(async()=>{const r=await BinderRepository.client.from('binders').select('*');return r.data[0].document.pages[0].regions[1].content.src})()")
                assert owner_path.startswith('storage:'),'Cloud documents must contain private Storage references'
                reload_editor('Live browser binder')
                cdp.evaluate("window.downloadedBackup=null;const create=URL.createObjectURL;URL.createObjectURL=blob=>{downloadedBackup=blob;return create(blob)};document.getElementById('download-backup').click()")
                assert cdp.evaluate("(async()=>JSON.parse(await downloadedBackup.text()).pages[0].regions[1].content.src.startsWith('data:image/png;base64,'))()"),'Downloaded backups must contain portable artwork'
                # Commit through another API request, then keep the stale editor draft.
                cdp.evaluate("(async()=>{const c=BinderRepository.client,r=await c.from('binders').select('*');const documents=r.data.map(b=>({id:b.id,document:{...b.document,name:'Other device'}}));const result=await c.rpc('commit_binders',{expected:r.data.map(b=>({id:b.id,revision:b.revision})),documents});if(result.error)throw Error(result.error.message)})()")
                cdp.evaluate("document.getElementById('rename-binder').click();document.getElementById('new-name').value='My stale draft';document.getElementById('name-form').requestSubmit();document.getElementById('save').click()")
                cdp.wait("document.getElementById('cloud-save-conflict')?.open",timeout=35)
                assert cdp.evaluate("document.getElementById('binder-title').textContent==='My stale draft'")
                # Reload must explicitly confirm before discarding an unsaved draft.
                cdp.evaluate("window.nativeConfirm=window.confirm;window.confirm=()=>false;[...document.querySelectorAll('#cloud-save-conflict button')].find(b=>b.textContent==='Reload saved version').click()")
                assert cdp.evaluate("document.getElementById('binder-title').textContent==='My stale draft'&&document.getElementById('cloud-save-conflict').open"),'Cancel reload must retain the draft'
                before = cdp.evaluate('performance.timeOrigin')
                cdp.evaluate("window.confirm=nativeConfirm;[...document.querySelectorAll('#cloud-save-conflict button')].find(b=>b.textContent==='Reload saved version').click()")
                cdp.wait("performance.timeOrigin!=="+str(before)+"&&!!window.EditorLayout&&document.getElementById('binder-title').textContent==='Other device'",timeout=35)
                cdp.evaluate("(async()=>{const c=BinderRepository.client,r=await c.from('binders').select('*');const result=await c.rpc('commit_binders',{expected:r.data.map(b=>({id:b.id,revision:b.revision})),documents:r.data.map(b=>({id:b.id,document:{...b.document,name:'Newer saved version'}}))});if(result.error)throw Error(result.error.message)})()")
                cdp.evaluate("document.getElementById('rename-binder').click();document.getElementById('new-name').value='My stale draft';document.getElementById('name-form').requestSubmit();document.getElementById('save').click()")
                cdp.wait("document.getElementById('cloud-save-conflict')?.open",timeout=35)
                cdp.evaluate("window.realRpc=BinderRepository.client.rpc.bind(BinderRepository.client);window.copyGate=new Promise(resolve=>window.releaseCopy=resolve);BinderRepository.client.rpc=(...args)=>{const query=realRpc(...args),originalThen=query.then.bind(query);query.then=(...handlers)=>copyGate.then(()=>originalThen(...handlers));return query}")
                cdp.evaluate("[...document.querySelectorAll('#cloud-save-conflict button')].find(b=>b.textContent==='Save as copy').click()")
                assert cdp.evaluate("[...document.querySelectorAll('#cloud-save-conflict button')].every(b=>b.disabled)"),'A pending copy must lock all conflict choices'
                cdp.escape()
                assert cdp.evaluate("document.getElementById('cloud-save-conflict').open"),'Escape must not release the draft while its copy is being saved'
                cdp.evaluate("releaseCopy();BinderRepository.client.rpc=realRpc")
                cdp.wait("!document.getElementById('cloud-save-conflict').open&&document.getElementById('binder-title').textContent==='My stale draft (copy)'",timeout=35)
                saved()
                binder_id = cdp.evaluate("JSON.parse(decodeURIComponent(location.hash.slice(1))).id")
                workspace(folder+workspace_name)
                cdp.evaluate("document.querySelector('.account').open=true;[...document.querySelectorAll('.account-panel button')].find(b=>b.textContent==='Import a browser binder').click()")
                cdp.wait("document.getElementById('local-binder-import')?.open")
                cdp.evaluate("[...document.querySelectorAll('#local-binder-import button')].find(b=>b.textContent==='Local original').click()")
                cdp.wait("document.querySelectorAll('#binder-grid .binder-card').length===3",timeout=35)
                assert cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")==original
                assert cdp.evaluate("localStorage.getItem('pokedex.collection.v1')")==collection
                check_collection_cloud(cdp, base, folder+workspace_name, folder+('discover.html' if folder=='src/' else 'Pokedex-discover.html'), ROOT)
                assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
                cdp.evaluate("sessionStorage.setItem('pokedex.copied-cards.v1',JSON.stringify({target:"+json.dumps(binder_id)+",owner:'another-account',cards:[{cardId:'001'}]}))")
                cdp.go(base+'/'+folder+editor_name+'#'+quote(json.dumps({'id':binder_id}),safe=''),"!!window.EditorLayout")
                assert cdp.evaluate("document.getElementById('paste-copied-cards').hidden"),'Another account\'s card clipboard must not be offered for paste'
                cdp.evaluate("sessionStorage.setItem('pokedex.copied-cards.v1','pending-clipboard')")
                cdp.evaluate("document.getElementById('rename-binder').click();document.getElementById('new-name').value='Unsaved sign-out draft';document.getElementById('name-form').requestSubmit();window.nativeConfirm=window.confirm;window.confirm=()=>false")
                cdp.evaluate('BinderRepository.signOut()')
                assert cdp.evaluate("(async()=>document.getElementById('binder-title').textContent==='Unsaved sign-out draft'&&(await BinderRepository.client.auth.getSession()).data.session!==null)()"),'Cancel sign-out must retain session and draft'
                before = cdp.evaluate('performance.timeOrigin')
                cdp.evaluate('window.confirm=nativeConfirm;void BinderRepository.signOut()')
                cdp.wait("performance.timeOrigin!=="+str(before)+"&&!!window.BinderRepository&&!window.BinderRepository.user&&[...document.querySelectorAll('.account-panel button')].some(b=>b.textContent==='Continue with Google')",timeout=35)
                assert cdp.evaluate("(async()=>!(await BinderRepository.client.auth.getSession()).data.session)()"),'Confirmed sign-out must remove the session'
                assert cdp.evaluate("sessionStorage.getItem('pokedex.copied-cards.v1')===null"),'Sign-out must clear the private card clipboard'
                auth(other_session)
                workspace(folder+workspace_name+'?account=second')
                assert cdp.evaluate('BinderRepository.user.id')==other_session['user']['id'],'Account switch must load the second authenticated user'
                assert cdp.evaluate("BinderRepository.read().length===0"),'Other account must have an empty private workspace'
                assert cdp.evaluate("(async()=>await CollectionRepository.read()===null)()"),'Other account must not inherit the owner collection'
                assert cdp.evaluate("(async()=>!!(await BinderRepository.client.storage.from('binder-artwork').download("+json.dumps(owner_path[8:])+" )).error)()"),'Other account cannot download even previously viewed private artwork'
                cdp.go(base+'/'+folder+viewer_name+'?binder='+binder_id,"!!window.BinderRepository?.user&&!document.getElementById('viewer-error').hidden")
                assert cdp.evaluate("document.getElementById('viewer-shell').hidden"),'A private viewer must not display the other account\'s binder'
                assert cdp.evaluate('testErrors.length===0'),cdp.evaluate('testErrors')
                print('PASS:',folder+' real Supabase browser create/place/Save/reopen, artwork restore/upload/portable backup, conflict reload/copy, sign-out confirmation, explicit local import, collection isolation and cross-account denial',flush=True)
                # The second disposable account is no longer needed after isolation
                # checks; use it for the destructive account-controls acceptance.
                check_account_cloud(cdp, base, folder+workspace_name)
        finally:
            if cdp:
                try:
                    cdp.call('Browser.close')
                except (OSError, RuntimeError):
                    pass
                cdp.socket.close()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            server.shutdown()


if __name__=='__main__':
    main()
