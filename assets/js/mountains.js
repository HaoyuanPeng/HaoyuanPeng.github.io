(() => {
  'use strict';
  const locations = JSON.parse(document.getElementById('mountains-locations').textContent);
  const source = document.getElementById('mountains-source');
  const records = Array.from(source.querySelectorAll('tbody tr')).map((row, index) => {
    const [name, altitude, date, note] = Array.from(row.cells, cell => cell.textContent.trim());
    const place = locations[name];
    const location = place && Number.isFinite(place.lat) && Number.isFinite(place.lng) ? place : null;
    if ((place && place.kind === 'attempt') || /失败|未登顶|不开放登顶|未开放登顶/.test(note)) {
      row.remove();
      return null;
    }
    return { index, name, altitude, date, note, location, region: place && place.region };
  }).filter(Boolean);
  source.querySelectorAll('table').forEach(table => {
    if (table.querySelector('tbody tr')) return;
    if (table.previousElementSibling && table.previousElementSibling.matches('h2')) table.previousElementSibling.remove();
    table.remove();
  });
  const list = document.getElementById('mountains-list');
  const scope = document.getElementById('mountains-scope');
  const search = document.getElementById('mountains-search');
  const status = document.getElementById('mountains-map-status');
  const markers = new Map();
  let map, layer, selected;
  let visible = [];
  let tileErrors = 0;
  const chinaBounds = [[18, 73], [54, 135]];
  document.getElementById('mountains-stats').textContent = `${records.length} 条山行足迹`;

  function selectRecord(record, focusMap) {
    selected = record.index;
    list.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.index) === selected)));
    const marker = markers.get(record.index);
    if (marker && focusMap) {
      map.setView(marker.getLatLng(), record.location.approximate ? 7 : 10);
      marker.openPopup();
    }
    if (!focusMap) {
      const button = list.querySelector(`[data-index="${record.index}"]`);
      if (button) button.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function fitMap() {
    if (!map) return;
    if (scope.value === 'china') map.fitBounds(chinaBounds, { padding: [12, 12] });
    else if (visible.some(r => r.location)) map.fitBounds(visible.filter(r => r.location).map(r => [r.location.lat, r.location.lng]), { padding: [30, 30], maxZoom: 8 });
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    visible = records.filter(r => (scope.value === 'world' || (scope.value === 'overseas' ? r.location && r.location.overseas : !(r.location && r.location.overseas))) && [r.name, r.date, r.note, r.region].join(' ').toLowerCase().includes(query));
    list.replaceChildren();
    if (layer) layer.clearLayers();
    markers.clear();
    document.getElementById('mountains-count').textContent = `${visible.length} 条 · ${visible.filter(r => r.location).length} 处落点`;
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'mountains-empty';
      empty.textContent = '暂无匹配的记录';
      list.append(empty);
    }
    visible.slice().reverse().forEach(record => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mountains-row';
      button.dataset.index = record.index;
      button.setAttribute('aria-pressed', String(selected === record.index));
      const title = document.createElement('span');
      title.className = 'mountains-row-title';
      const dot = document.createElement('i');
      dot.className = 'fas fa-mountain mountains-row-icon';
      dot.setAttribute('aria-hidden', 'true');
      title.append(dot, document.createTextNode(record.name));
      const meta = document.createElement('span');
      meta.className = 'mountains-row-meta';
      meta.textContent = [record.altitude, record.date].filter(Boolean).join(' · ');
      const note = document.createElement('span');
      note.className = 'mountains-row-note';
      note.textContent = [record.region, record.location && record.location.approximate && '大致位置', !record.location && '位置待补充', record.note].filter(Boolean).join(' · ');
      button.append(title, meta, note);
      button.addEventListener('click', () => selectRecord(record, true));
      list.append(button);
      if (!map || !record.location) return;
      const popup = document.createElement('div');
      popup.className = 'mountains-popup';
      const heading = document.createElement('h3');
      heading.textContent = record.name;
      popup.append(heading);
      [record.altitude, record.date, record.note].filter(Boolean).forEach(text => {
        const p = document.createElement('p');
        p.textContent = text;
        popup.append(p);
      });
      const accuracy = document.createElement('small');
      accuracy.textContent = `${record.location.region} · ${record.location.approximate ? '大致位置（区域示意点）' : '约略位置'}`;
      popup.append(accuracy);
      const icon = L.divIcon({ className: 'mountains-marker', html: '<i class="fas fa-mountain" aria-hidden="true"></i>', iconSize: [26, 26], iconAnchor: [13, 23], popupAnchor: [0, -22] });
      const marker = L.marker([record.location.lat, record.location.lng], { icon, title: record.name, alt: record.name }).bindPopup(popup).bindTooltip(record.name).addTo(layer);
      marker.on('click', () => selectRecord(record, false));
      markers.set(record.index, marker);
    });
  }

  if (window.L) {
    map = L.map('mountains-map', {
      scrollWheelZoom: true,
      touchZoom: true,
      wheelPxPerZoomLevel: 30,
      wheelDebounceTime: 20,
      minZoom: 2,
      maxZoom: 16,
      zoomSnap: .25
    });
    map.on('resize', fitMap);
    layer = L.layerGroup().addTo(map);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
    tiles.on('tileerror', () => {
      tileErrors += 1;
      status.hidden = false;
      status.textContent = '部分底图未能加载，山峰标记及记录仍可查看。';
    });
    tiles.on('load', () => { if (!tileErrors) status.hidden = true; });
    tiles.addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    source.closest('details').open = false;
  } else {
    status.textContent = '地图组件未能加载，请稍后刷新。完整记录仍可查看。';
  }
  search.addEventListener('input', render);
  scope.addEventListener('change', () => { render(); fitMap(); });
  document.getElementById('mountains-reset').addEventListener('click', fitMap);
  render();
  fitMap();
})();
