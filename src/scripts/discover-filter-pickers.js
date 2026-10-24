/* Native selects retain form reset and URL state; checklists provide multi-select. */
(() => {
  const pickers = [];
  const maximum = 20;
  function fitFloatingPanel(details) {
    if (details.closest('#filters-form')) return;
    const panel = details.querySelector('.filter-picker-panel, .color-section');
    if (panel) panel.style.maxHeight = Math.max(180, innerHeight - panel.getBoundingClientRect().top - 12) + 'px';
  }
  const types = {
    Fire: ['#b75b38','M12 3c1 5 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 0 3 1 4 2 4 2-2 2-5 1-8Z'],
    Water: ['#397dad','M12 3C10 7 6 11 6 15a6 6 0 0 0 12 0c0-4-4-8-6-12Z'],
    Grass: ['#588544','M19 4C7 3 3 9 6 16c7 5 14-1 13-12ZM6 18l9-9'],
    Lightning: ['#9b7c20','m14 2-9 12h6l-1 8 9-13h-6Z'],
    Psychic: ['#a65d89','M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
    Fighting: ['#9b6b4b','M6 12V8a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v5h2v5l-4 4H8l-5-7v-3a2 2 0 0 1 3 1Z'],
    Darkness: ['#536475','M17 4A9 9 0 1 0 20 17 8 8 0 0 1 17 4Z'],
    Metal: ['#737f89','m12 3 8 4v10l-8 4-8-4V7Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
    Fairy: ['#aa739b','m12 3 2 6 6 3-6 3-2 6-2-6-6-3 6-3Z'],
    Dragon: ['#8f783f','m5 19 4-8-4-4 10-4 4 6-5 2 4 4-5 6-2-5Z'],
    Colorless: ['#777e89','m12 3 2 6 7-1-5 5 4 6-7-2-4 5v-7l-6-3 7-2Z'],
  };
  function typeSymbol(type) {
    const [color,pathData] = types[type] || ['#777e89','M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14'];
    const holder = document.createElement('span');
    holder.className = 'type-symbol';
    holder.style.setProperty('--type-color',color);
    holder.setAttribute('aria-hidden','true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');
    const path = document.createElementNS(svg.namespaceURI,'path');
    path.setAttribute('d',pathData);
    svg.append(path);
    holder.append(svg);
    return holder;
  }
  function sync() {
    for (const { select, summary, rows, label } of pickers) {
      const chosen = [...select.selectedOptions].filter(o => o.value);
      summary.textContent = label;
      summary.setAttribute('aria-label', label + ' filter' + (chosen.length ? `, ${chosen.length} selected` : ''));
      if (chosen.length) {
        const badge = document.createElement('span');
        badge.className = 'filter-badge';
        badge.textContent = chosen.length;
        badge.setAttribute('aria-hidden','true');
        summary.append(badge);
      }
      summary.classList.toggle('has-selection', chosen.length > 0);
      for (const { option, input } of rows) input.checked = option.selected;
      for (const { input } of rows) input.disabled = select.disabled || select.multiple && chosen.length >= maximum && !input.checked;
    }
  }
  function initialize(multiple) {
    for (const [id, label] of [['set-filter','Set'],['type-filter','Type'],['rarity-filter','Rarity'],['category-filter','Category'],['finish-filter','Finish'],['illustrator-filter','Illustrator']]) {
      const select = document.getElementById(id);
      select.multiple = multiple;
      const details = document.createElement('details');
      details.className = 'filter-picker';
      details.dataset.filter = id;
      const summary = document.createElement('summary');
      summary.setAttribute('aria-label', label + ' filter');
      const panel = document.createElement('div');
      panel.className = 'filter-picker-panel';
      const search = document.createElement('input');
      search.type = 'search';
      search.placeholder = 'Find ' + label.toLowerCase();
      search.setAttribute('aria-label', 'Search ' + label.toLowerCase() + ' options');
      const list = document.createElement('div');
      list.className = 'filter-picker-list';
      if (id === 'type-filter') {
        list.classList.add('type-picker-list');
        panel.classList.add('type-picker-panel');
        const match = document.getElementById('type-match-field');
        match.hidden = false;
        document.getElementById('type-match').disabled = !multiple;
        panel.append(match);
      }
      const rows = [...select.options].filter(o => o.value).map(option => {
        const row = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.addEventListener('change', () => {
          if (!multiple) select.value = input.checked ? option.value : '';
          else option.selected = input.checked;
          select.options[0].selected = ![...select.options].some(o => o.value && o.selected);
          select.dispatchEvent(new Event('change', { bubbles: true }));
          sync();
        });
        const text = document.createElement('span');
        text.textContent = option.textContent;
        row.append(input);
        if (id === 'type-filter') row.append(typeSymbol(option.value));
        row.append(text);
        list.append(row);
        return { row, option, input };
      });
      const empty = document.createElement('p');
      empty.textContent = 'No matching options';
      empty.hidden = true;
      search.addEventListener('input', () => {
        for (const {row,option} of rows) row.hidden = !option.textContent.toLowerCase().includes(search.value.trim().toLowerCase());
        empty.hidden = rows.some(({row}) => !row.hidden);
      });
      const resetSearch = () => {
        search.value = '';
        for (const {row} of rows) row.hidden = false;
        empty.hidden = true;
      };
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'button secondary';
      clear.textContent = 'Clear ' + label.toLowerCase();
      clear.addEventListener('click', () => {
        resetSearch();
        select.value = '';
        select.dispatchEvent(new Event('change', {bubbles:true}));
        sync();
      });
      panel.append(search, list, empty, clear);
      details.append(summary, panel);
      select.parentElement.before(details);
      select.parentElement.hidden = true;
      details.addEventListener('toggle', () => {
        if (select.disabled) { details.open=false; return; }
        if (details.open) {
          document.querySelectorAll('.filter-picker[open], #filters-panel[open], #color-tools[open]').forEach(other => { if(other !== details && !other.contains(details)) other.open = false; });
          fitFloatingPanel(details);
        }
      });
      pickers.push({select,summary,rows,label,resetSearch});
    }
    document.addEventListener('click', e => document.querySelectorAll('.filter-picker[open]').forEach(d => {if (!d.contains(e.target)) d.open=false;}));
    const advanced = document.getElementById('filters-panel');
    function fitAdvancedPanel() {
      const form = document.getElementById('filters-form');
      if (!advanced.open || innerWidth <= 980) {
        form.style.removeProperty('--available-filter-height');
        return;
      }
      form.style.setProperty('--available-filter-height', Math.max(180, innerHeight - form.getBoundingClientRect().top - 12) + 'px');
    }
    advanced.addEventListener('toggle', e => {
      if (e.target.open) document.querySelectorAll('.filter-picker[open]').forEach(d => d.open = false);
      fitAdvancedPanel();
    });
    const color = document.getElementById('color-tools');
    color.addEventListener('toggle', () => {
      if (color.open) {
        document.querySelectorAll('.filter-picker[open], #filters-panel[open]').forEach(d => d.open=false);
        fitFloatingPanel(color);
      }
    });
    window.addEventListener('resize', fitAdvancedPanel);
    window.addEventListener('resize', () => document.querySelectorAll('.filter-picker[open], #color-tools[open]').forEach(fitFloatingPanel));
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      const open = document.querySelector('.filter-picker[open]');
      if (open) { open.open=false; open.querySelector('summary').focus(); e.preventDefault(); e.stopPropagation(); }
    }, true);
    sync();
  }
  window.DiscoverFilterPickers = { initialize, sync, resetSearches: () => pickers.forEach(p => p.resetSearch()) };
})();
