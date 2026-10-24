"""Ten-set UI acceptance against the local database and disposable account."""
import json


def check_catalogue_cloud(cdp, base, folder, workspace, editor, viewer):
    discover = 'discover.html' if folder == 'src/' else 'Pokedex-discover.html'
    cdp.go(base + '/' + folder + discover, "CardCatalogue?.enabled&&document.querySelectorAll('#card-grid > button').length===24")
    assert cdp.evaluate('CardCatalogue.info.sets.length>=10&&CardCatalogue.info.count>=1291')
    assert cdp.evaluate('CARDS.length<150'), 'Opening Discover must not download every card record'
    first = cdp.evaluate("[...document.querySelectorAll('#card-grid > button')].map(b=>b.dataset.cardId)")
    cdp.evaluate("document.getElementById('next-results').click()")
    cdp.wait("document.getElementById('page-status').textContent.startsWith('Page 2 ')")
    second = cdp.evaluate("[...document.querySelectorAll('#card-grid > button')].map(b=>b.dataset.cardId)")
    assert not set(first).intersection(second)
    cdp.evaluate("document.getElementById('card-query').value='base1-4';document.getElementById('card-query').dispatchEvent(new Event('input'))")
    cdp.wait("document.querySelectorAll('#card-grid > button').length===1&&document.querySelector('#card-grid > button').dataset.cardId==='base1-4'")
    cdp.evaluate("document.querySelector('#card-grid > button').click();document.getElementById('add-to-collection').click()")
    cdp.wait("document.getElementById('inventory-dialog').open")
    cdp.evaluate("document.getElementById('inventory-apply').click();document.getElementById('detail-collection-save').click()")
    cdp.wait("document.getElementById('detail-collection-save').hidden", timeout=35)
    cdp.go(base+'/'+folder+workspace+'?tab=collection', "document.querySelectorAll('#collection-list .inventory-card').length===1")
    assert cdp.evaluate("(async()=>{const c=await CollectionRepository.read();return c.document.records[0].cardId==='base1-4'})()"), 'New printing survives a fresh page load'
    cdp.evaluate("document.getElementById('collection-add').click()")
    cdp.wait("document.getElementById('inventory-dialog').open&&document.querySelectorAll('#inventory-card-grid > button').length===24")
    cdp.evaluate("document.querySelector('#inventory-card-grid > button').click();document.querySelector('#inventory-picker-area .catalogue-pagination button:last-child').click()")
    cdp.wait("document.querySelector('#inventory-picker-area .catalogue-pagination span').textContent.startsWith('Page 2 ')")
    cdp.evaluate("document.querySelector('#inventory-card-grid > button').click();document.getElementById('inventory-apply').click();document.getElementById('inventory-apply').click();document.getElementById('collection-save').click()")
    cdp.wait("document.querySelectorAll('#collection-list .inventory-card').length===3&&document.getElementById('collection-save').disabled&&!document.getElementById('collection-save').hasAttribute('aria-busy')", timeout=35)
    cdp.evaluate("document.getElementById('collection-add').click()")
    cdp.wait("document.getElementById('inventory-dialog').open&&document.querySelectorAll('#inventory-card-grid > button').length===24")
    cdp.evaluate("document.getElementById('inventory-card-search').value='base5-4';document.getElementById('inventory-card-search').dispatchEvent(new Event('input'))")
    cdp.wait("document.querySelectorAll('#inventory-card-grid > button').length===1&&document.querySelector('#inventory-card-grid > button').dataset.card==='base5-4'")
    cdp.evaluate("document.getElementById('inventory-dialog').close()")
    cdp.evaluate("window.testBackup=null;window.nativeCreate=URL.createObjectURL;URL.createObjectURL=b=>{testBackup=b;return nativeCreate(b)};document.getElementById('collection-download').click()")
    assert cdp.evaluate("(async()=>JSON.parse(await testBackup.text()).document.records[0].cardId==='base1-4')()")
    cdp.evaluate("(async()=>{let dt=new DataTransfer();dt.items.add(new File([testBackup],'collection.json'));let input=document.getElementById('collection-import');input.files=dt.files;input.dispatchEvent(new Event('change'))})()")
    cdp.wait("document.getElementById('collection-confirm').open")
    cdp.evaluate("document.getElementById('collection-confirm-yes').click()")
    cdp.go(base+'/'+folder+workspace, "!!BinderRepository?.user&&document.querySelector('#binder-grid')?.getAttribute('aria-busy')==='false'")
    cdp.evaluate("document.getElementById('create-binder').click();document.getElementById('binder-name').value='Catalogue acceptance';document.getElementById('form-submit').click()")
    cdp.wait("document.querySelectorAll('#binder-grid .binder-card').length===1&&!document.getElementById('edit-dialog').open")
    cdp.evaluate("document.querySelector('.edit-binder-action').click()")
    try:
        cdp.wait("window.EditorLayout&&document.querySelectorAll('#card-results .catalogue-card').length===24")
    except Exception:
        print(cdp.evaluate("(async()=>{let r=await fetch('scripts/editor-arrange.js');let t=await r.text();let parsed='ok';try{new Function(t)}catch(e){parsed=e.message}return {status:r.status,length:t.length,parsed,errors:testErrors}})()"), flush=True)
        raise
    cdp.evaluate("EditorLayout.setCards(true);document.getElementById('card-search').value='base1-4';document.getElementById('card-search').dispatchEvent(new Event('input'))")
    cdp.wait("document.querySelectorAll('#card-results .catalogue-card').length===1&&document.querySelector('#card-results .catalogue-card').dataset.focusKey==='catalogue:base1-4'")
    cdp.evaluate("document.querySelector('#card-results .catalogue-card').click();document.querySelector('#binder-page .editor-pocket').click();document.getElementById('save').click()")
    cdp.wait("document.getElementById('save').disabled&&!document.getElementById('save').hasAttribute('aria-busy')", timeout=35)
    before = cdp.evaluate('performance.timeOrigin')
    cdp.call('Page.reload')
    cdp.wait("performance.timeOrigin!=="+str(before)+"&&window.EditorLayout&&BinderRepository.read()[0]?.document.pages[0].regions[0].content?.cardId==='base1-4'")
    binder_id = cdp.evaluate('BinderRepository.read()[0].id')
    cdp.go(base+'/'+folder+viewer+'?binder='+binder_id, "!document.getElementById('viewer-shell').hidden&&document.getElementById('viewer-error').hidden")
    assert cdp.evaluate("CardCatalogue.byId.has('base1-4')"), 'Viewer hydrates saved printing metadata'
    assert cdp.evaluate('testErrors.length===0'), cdp.evaluate('testErrors')
    cdp.go(base+'/'+folder+workspace, "!!BinderRepository?.user&&document.querySelector('#binder-grid')?.getAttribute('aria-busy')==='false'")
    cdp.evaluate("(async()=>{let b=BinderRepository.read();let r=await BinderRepository.client.rpc('commit_binders',{expected:b.map(x=>({id:x.id,revision:x.revision})),documents:[]});if(r.error)throw Error(r.error.message);let c=await CollectionRepository.read();r=await BinderRepository.client.rpc('commit_collection',{expected_revision:c.revision,document:{records:[]}});if(r.error)throw Error(r.error.message)})()")
    print('PASS:', folder, 'catalogue pages/search, lazy metadata, new-card collection/binder Save/reload, portable collection restore and viewer hydration', flush=True)
