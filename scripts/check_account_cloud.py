"""Account data acceptance in a disposable browser and local account only."""
import base64
from pathlib import Path

def check_account_cloud(cdp, base, route):
    cdp.go(base+'/'+route, "!!window.AccountData&&document.getElementById('collection-save-status').textContent.includes('saved')")
    cdp.evaluate("(async()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=2;const context=canvas.getContext('2d');context.fillRect(0,0,2,2);const src=canvas.toDataURL('image/png'),doc=BinderState.create({name:'Recovery acceptance',rows:2,columns:2,cards:['001']}).document;doc.pages[0].regions[1].content={id:crypto.randomUUID(),kind:'artwork',src,name:'Account artwork',width:2,height:2,fit:'contain',zoom:1,x:50,y:50};context.fillStyle='red';context.fillRect(0,0,2,2);const other=structuredClone(doc),src2=canvas.toDataURL('image/png');other.name='Second';other.pages[0].regions[1].content.src=src2;await AccountData.restoreData({format:'pokedex-account',version:1,binders:[doc,other,{...structuredClone(doc),name:'Third'}],collection:SAMPLE_COLLECTION,artwork:[src,src2]});await BinderRepository.refresh()})()")
    before = cdp.evaluate('performance.timeOrigin')
    cdp.call('Page.reload')
    cdp.wait("performance.timeOrigin!=="+str(before)+"&&!!window.AccountData&&document.querySelectorAll('#binder-grid .binder-card').length===3&&!!document.querySelector('#collection-list .inventory-card')",timeout=35)
    cdp.evaluate("document.querySelector('#collection-list .inventory-card').click();document.getElementById('inventory-quantity').value=9;document.getElementById('inventory-apply').click();document.querySelector('.account').open=true;[...document.querySelectorAll('.account-panel button')].find(b=>b.textContent==='Account data').click()")
    assert cdp.evaluate("!document.getElementById('account-data-dialog').open&&document.querySelector('.account-panel [role=status]').textContent.includes('collection draft')"), 'Dirty collection blocks account actions with visible guidance'
    cdp.go(base+'/'+route+'?account-controls=1', "!!window.AccountData&&document.getElementById('collection-save-status').textContent.includes('saved')")
    original = cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")
    inventory = cdp.evaluate("localStorage.getItem('pokedex.collection.v1')")
    cdp.evaluate("window.accountBackup=null;window.realObjectURL=URL.createObjectURL;URL.createObjectURL=blob=>{window.accountBackup=blob;return realObjectURL(blob)};document.querySelector('.account').open=true;[...document.querySelectorAll('.account-panel button')].find(b=>b.textContent==='Account data').click()")
    cdp.wait("document.getElementById('account-data-dialog').open")
    assert cdp.evaluate("document.querySelector('.account-danger').disabled"), 'Delete starts disabled'
    cdp.escape()
    cdp.wait("!document.getElementById('account-data-dialog').open&&document.activeElement.matches('.account > summary')")
    cdp.evaluate("document.querySelector('.account').open=true;[...document.querySelectorAll('.account-panel button')].find(b=>b.textContent==='Account data').click()")
    folder = Path(__file__).resolve().parents[1]/'.scratch/qa'
    folder.mkdir(parents=True,exist_ok=True)
    screenshot = cdp.call('Page.captureScreenshot', {'format':'png'})
    (folder/('account-data-source.png' if route.startswith('src/') else 'account-data-preview.png')).write_bytes(base64.b64decode(screenshot['data']))
    cdp.evaluate("[...document.querySelectorAll('#account-data-dialog button')].find(b=>b.textContent==='Download all my data').click()")
    cdp.wait("!!accountBackup&&!document.getElementById('account-data-dialog').hasAttribute('aria-busy')", timeout=35)
    result = cdp.evaluate("(async()=>{window.exportedAccount=JSON.parse(await accountBackup.text());return {format:exportedAccount.format,binders:exportedAccount.binders.length,records:exportedAccount.collection.records.length,art:exportedAccount.artwork.length,inline:exportedAccount.binders.some(b=>JSON.stringify(b).includes('data:image/'))}})()")
    assert result['format']=='pokedex-account' and result['binders']==3 and result['records']>0 and result['art']>0 and result['inline'], result
    assert cdp.evaluate("!JSON.stringify(exportedAccount).includes('access_token')&&!JSON.stringify(exportedAccount).includes('refresh_token')"), 'Backup excludes credentials'
    # UI round trip restores both snapshots, not only an in-memory editor draft.
    before = cdp.evaluate('performance.timeOrigin')
    cdp.evaluate("(()=>{const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(exportedAccount)],'account.json',{type:'application/json'}));document.getElementById('account-backup-file').files=dt.files;window.savedConfirm=window.confirm;window.confirm=()=>true;window.persistedBackup=JSON.stringify(exportedAccount);sessionStorage.setItem('accountAcceptanceBackup',persistedBackup);[...document.querySelectorAll('#account-data-dialog button')].find(b=>b.textContent==='Restore account backup').click()})()")
    cdp.wait("performance.timeOrigin!=="+str(before)+"&&!!window.AccountData&&document.getElementById('binder-grid').getAttribute('aria-busy')==='false'",timeout=40)
    assert cdp.evaluate("(async()=>{const expected=JSON.parse(sessionStorage.getItem('accountAcceptanceBackup')),actual=await AccountData.exportData();return JSON.stringify(actual.binders)===JSON.stringify(expected.binders)&&JSON.stringify(actual.collection)===JSON.stringify(expected.collection)&&actual.artwork.length===expected.artwork.length})()"), 'Restored saved account matches export with artwork'
    assert cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")==original
    assert cdp.evaluate("localStorage.getItem('pokedex.collection.v1')")==inventory
    # A Storage outage must leave deletion pending and retryable, even after reload
    # when a missing artwork file prevents normal binder hydration.
    cdp.evaluate("window.realFetch=window.fetch;window.fetch=async(url,options)=>{if(options?.method==='DELETE'&&String(url).includes('/storage/v1/object/')){const body=JSON.parse(options.body);await realFetch(url,{...options,body:JSON.stringify({prefixes:[body.prefixes[0]]})});throw Error('Simulated artwork outage')}return realFetch(url,options)};document.querySelector('.account').open=true;[...document.querySelectorAll('.account-panel button')].find(b=>b.textContent==='Account data').click();const input=document.getElementById('account-delete-confirmation');input.value='DELETE';input.dispatchEvent(new Event('input'));document.querySelector('.account-danger').click()")
    cdp.wait("document.querySelector('#account-data-dialog [role=status]').textContent.includes('Simulated artwork outage')",timeout=35)
    assert cdp.evaluate("(async()=>{const r=await BinderRepository.client.rpc('account_snapshot');return r.data.deleting&&r.data.binders.length===3})()"), 'Failed artwork deletion keeps account and records'
    cdp.call('Page.reload')
    cdp.wait("!!window.AccountData&&[...document.querySelectorAll('.account-panel button')].some(b=>b.textContent==='Account data')&&(()=>{try{BinderRepository.read();return false}catch(e){return e.message.includes('private artwork')}})()",timeout=35)
    cdp.evaluate("document.querySelector('.account').open=true;[...document.querySelectorAll('.account-panel button')].find(b=>b.textContent==='Account data').click();const input=document.getElementById('account-delete-confirmation');input.value='DELETE';input.dispatchEvent(new Event('input'));document.querySelector('.account-danger').click()")
    cdp.wait("!!window.BinderRepository&&!BinderRepository.user&&[...document.querySelectorAll('.account-panel button')].some(b=>b.textContent==='Continue with Google')",timeout=40)
    assert cdp.evaluate("localStorage.getItem('pokedex.workspace.v1')")==original
    assert cdp.evaluate("localStorage.getItem('pokedex.collection.v1')")==inventory
    cdp.evaluate("sessionStorage.removeItem('accountAcceptanceBackup')")
    print('PASS: account backup download/restore with real artwork, typed deletion, failed Storage retry, sign-out and browser-original preservation', flush=True)
