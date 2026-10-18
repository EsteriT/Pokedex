"""UI acceptance using the real local services and disposable test sessions."""
import base64
import json
from urllib.parse import quote


def check_collection_cloud(cdp, base, route, discover, root):
    url = base + '/' + route + '?tab=collection'
    ready = "!!window.CollectionRepository&&document.getElementById('collection-save-status').textContent.includes('saved')"
    cdp.go(url, ready)
    original = cdp.evaluate("localStorage.getItem('pokedex.collection.v1')")
    assert cdp.evaluate("document.querySelectorAll('#collection-list .inventory-card').length===0"), 'Cloud account starts empty, without sample ownership'

    def saved():
        cdp.wait("document.getElementById('collection-save').disabled&&!document.getElementById('collection-save').hasAttribute('aria-busy')&&!document.getElementById('collection-add').disabled", timeout=35)

    def edit_quantity(n):
        cdp.evaluate("document.querySelector('#collection-list .inventory-card').click();document.getElementById('inventory-quantity').value="+str(n)+";document.getElementById('inventory-apply').click()")

    def quantity():
        return cdp.evaluate("(async()=>{const s=await CollectionRepository.read();return s.document.records.find(r=>r.cardId==='001'&&r.kind==='owned').quantity})()")

    selection = quote(json.dumps({'cardId':'001','finish':'normal','kind':'owned'}), safe='')
    cdp.call('Page.navigate', {'url': url+'&select=1#'+selection})
    cdp.wait("document.getElementById('inventory-dialog').open")
    cdp.evaluate("document.getElementById('inventory-quantity').value=2;document.getElementById('inventory-condition').value='nm';document.getElementById('inventory-apply').click()")
    assert cdp.evaluate("(async()=>await CollectionRepository.read()===null)()"), 'Adding is a draft only'
    cdp.evaluate("document.getElementById('collection-save').click()")
    saved()
    assert quantity() == 2
    cdp.go(url+'&reopen=1', ready)
    assert cdp.evaluate("document.querySelectorAll('#collection-list .inventory-card').length===1")
    assert cdp.evaluate("localStorage.getItem('pokedex.collection.v1')") == original

    # Another client saves after this tab loaded; stale Save must preserve its draft.
    edit_quantity(3)
    cdp.evaluate("(async()=>{const s=await CollectionRepository.read();s.document.records[0].quantity=9;const r=await BinderRepository.client.rpc('commit_collection',{expected_revision:s.revision,document:s.document});if(r.error)throw Error(r.error.message)})()")
    cdp.evaluate("document.getElementById('collection-save').click()")
    cdp.wait("document.getElementById('collection-sync-message').textContent.includes('changed on another device')")
    assert quantity() == 9
    cdp.evaluate("window.collectionBackup=null;const originalURL=URL.createObjectURL;URL.createObjectURL=blob=>{collectionBackup=blob;return originalURL(blob)};document.getElementById('collection-download').click()")
    assert cdp.evaluate("(async()=>JSON.parse(await collectionBackup.text()).document.records[0].quantity===3)()"), 'Conflict preserves downloadable draft'
    cdp.evaluate("document.getElementById('collection-reload').click()")
    cdp.wait("document.getElementById('collection-confirm').open")
    cdp.evaluate("document.getElementById('collection-confirm-cancel').click()")
    assert cdp.evaluate("!document.getElementById('collection-save').disabled")
    cdp.evaluate("document.getElementById('collection-reload').click();document.getElementById('collection-confirm-yes').click()")
    saved()

    # Changes made while Save is awaiting the API must remain dirty afterward.
    edit_quantity(4)
    cdp.evaluate("window.collectionRpc=BinderRepository.client.rpc.bind(BinderRepository.client);window.saveGate=new Promise(r=>window.releaseCollection=r);BinderRepository.client.rpc=(...args)=>{const query=collectionRpc(...args),originalThen=query.then.bind(query);query.then=(...handlers)=>saveGate.then(()=>originalThen(...handlers));return query};document.getElementById('collection-save').click()")
    edit_quantity(5)
    cdp.evaluate("releaseCollection();BinderRepository.client.rpc=collectionRpc")
    cdp.wait("!document.getElementById('collection-save').hasAttribute('aria-busy')")
    assert quantity() == 4
    assert cdp.evaluate("!document.getElementById('collection-save').disabled"), 'Newer edits remain unsaved'
    cdp.evaluate("document.getElementById('collection-save').click()")
    saved()
    assert quantity() == 5

    # An offline failure is visible and leaves a retryable draft.
    edit_quantity(6)
    cdp.evaluate("BinderRepository.client.rpc=(...args)=>{const query=collectionRpc(...args);query.then=(...handlers)=>Promise.resolve({error:{message:'Network unavailable'}}).then(...handlers);return query};document.getElementById('collection-save').click()")
    cdp.wait("document.getElementById('collection-sync-message').textContent==='Network unavailable'")
    assert quantity() == 5
    cdp.evaluate("BinderRepository.client.rpc=collectionRpc;document.getElementById('collection-undo').click()")
    saved()

    # Explicit import choices do not sum quantities, and repeat imports are stable.
    cdp.evaluate("CollectionStore.save(SAMPLE_COLLECTION,CollectionStore.read()?.revision??null)")
    local_snapshot = cdp.evaluate("localStorage.getItem('pokedex.collection.v1')")

    def open_import():
        cdp.evaluate("document.querySelector('.collection-more').open=true;document.getElementById('collection-browser-import').click()")
        cdp.wait("document.getElementById('collection-browser-title')?.closest('dialog').open")

    open_import()
    cdp.evaluate("[...document.querySelectorAll('.cloud-dialog button')].find(b=>b.textContent==='Import into draft').click()")
    assert cdp.evaluate("document.getElementById('collection-browser-title').closest('dialog').querySelector('[role=alert]').textContent.includes('Choose')")
    screenshots = root/'.scratch/screenshots'
    screenshots.mkdir(parents=True, exist_ok=True)
    suffix = 'source' if route.startswith('src/') else 'preview'
    for theme in ('dark','light'):
        cdp.evaluate("document.documentElement.dataset.theme="+json.dumps(theme))
        assert cdp.evaluate("(()=>{const r=document.getElementById('collection-browser-title').closest('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()")
        (screenshots/('collection-import-'+suffix+'-'+theme+'.png')).write_bytes(base64.b64decode(cdp.call('Page.captureScreenshot',{'format':'png'})['data']))
    cdp.evaluate("(()=>{const d=document.getElementById('collection-browser-title').closest('dialog');d.querySelector('select').value='keep';[...d.querySelectorAll('button')].find(b=>b.textContent==='Import into draft').click();document.getElementById('collection-save').click()})()")
    saved()
    assert quantity() == 5
    assert cdp.evaluate("(async()=>(await CollectionRepository.read()).document.records.length===6)()")
    open_import()
    cdp.evaluate("(()=>{const d=document.getElementById('collection-browser-title').closest('dialog');d.querySelector('select').value='replace';[...d.querySelectorAll('button')].find(b=>b.textContent==='Import into draft').click();document.getElementById('collection-save').click()})()")
    saved()
    assert quantity() == 2
    assert cdp.evaluate("localStorage.getItem('pokedex.collection.v1')") == local_snapshot

    # Portable backup restore remains a draft until explicitly saved.
    cdp.evaluate("document.getElementById('collection-download').click()")
    cdp.evaluate("(()=>{const dt=new DataTransfer();dt.items.add(new File([collectionBackup],'collection.json',{type:'application/json'}));const input=document.getElementById('collection-import');input.files=dt.files;input.dispatchEvent(new Event('change'))})()")
    cdp.wait("document.getElementById('collection-confirm').open")
    cdp.evaluate("document.getElementById('collection-confirm-yes').click()")
    # Same backup may be identical; restoring must not manufacture extra copies.
    assert quantity() == 2

    # Discover uses the same account collection, not the untouched local snapshot.
    cdp.go(base+'/'+discover, "!!window.DiscoverCollection&&document.querySelectorAll('#card-grid > button').length===24")
    cdp.evaluate("document.querySelector('#card-grid > button').click();document.getElementById('add-to-collection').click()")
    cdp.wait("document.getElementById('inventory-dialog').open")
    cdp.evaluate("document.getElementById('inventory-quantity').value=1;document.getElementById('inventory-apply').click();document.getElementById('detail-collection-save').click()")
    cdp.wait("document.getElementById('detail-collection-save').hidden", timeout=35)
    assert cdp.evaluate("localStorage.getItem('pokedex.collection.v1')") == local_snapshot
    cdp.evaluate("localStorage.setItem('pokedex.collection.v1',"+json.dumps(original)+")" if original is not None else "localStorage.removeItem('pokedex.collection.v1')")
    assert cdp.evaluate('testErrors.length===0'), cdp.evaluate('testErrors')
    cdp.go(url,ready)
    print('PASS:',route,'real cloud collection draft/Save/reopen, stale conflict/recovery, pending Save edits, offline retention, import overlaps/repeat safety, portable backup, Discover and local isolation',flush=True)
