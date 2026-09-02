'use strict';

/*
 * Car Dashboard for Homey Pro
 * Copyright (C) 2026 Gonçalo Barradas
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


function cap(device, id) {
  try {
    const v = device.capabilitiesObj && device.capabilitiesObj[id] && device.capabilitiesObj[id].value;
    return (typeof v === 'number') ? v : null;
  } catch (e) { return null; }
}

function summarizeDevice(device) {
  const caps = device.capabilitiesObj || {};
  const v = (id) => (caps[id] ? caps[id].value : undefined);
  return {
    id: device.id,
    name: device.name,
    zone: device.carZoneName || device.zoneName,
    zoneOrder: (device.carZoneOrder !== undefined ? device.carZoneOrder : 999),
    position: cap(device, 'windowcoverings_set'),
    dim: cap(device, 'dim'),
    class: device.virtualClass || device.class,
    available: device.available !== false,
    garageClosed: v('garagedoor_closed'),
    locked: v('locked'),
    on: v('onoff'),
    dim: v('dim'),
    temperature: v('measure_temperature'),
    humidity: v('measure_humidity'),
    targetTemperature: v('target_temperature'),
    coverState: v('windowcoverings_state'),
    coverPosition: v('windowcoverings_set'),      // 0..1 position-based blinds
    hasCoverState: (device.capabilities || []).includes('windowcoverings_state'),
    hasCoverSet: (device.capabilities || []).includes('windowcoverings_set'),
    contactAlarm: v('alarm_contact'),
    power: v('measure_power'),          // W
    batteryLevel: v('measure_battery'), // %
  };
}

const kw = (w) => Math.abs(w) >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`;

function buildEnergyState(tile, deviceMap, report) {
  const roles = tile.roles || {};
  const state = { tileId: tile.id, type: 'energy', label: tile.label || 'Energy', columns: [], notes: [] };

  const getRole = (name) => {
    const id = roles[name];
    if (!id || id === 'calculated') return null; // not configured -> column absent
    const d = deviceMap[id];
    if (!d) return { missing: true, name };
    return summarizeDevice(d);
  };

  const solar = getRole('solar');
  const battery = getRole('battery');
  const grid = getRole('grid');
  const consDev = getRole('consumption');
  const ev = getRole('ev');

  let solarW = null, battW = null, gridW = null, evW = null;

  if (ev) {
    if (ev.missing || !ev.available || typeof ev.power !== 'number') {
      state.columns.push({ key: 'ev', value: '—' });
      state.notes.push(`${ev.name || 'EV charger'} unreachable`);
    } else {
      evW = Math.abs(ev.power);
      state.columns.push({ key: 'ev', value: kw(evW), charging: evW > 50 });
    }
  }

  if (solar) {
    if (solar.missing || !solar.available || typeof solar.power !== 'number') {
      state.columns.push({ key: 'solar', value: '—' });
      state.notes.push(`${solar.name || 'solar'} unreachable`);
    } else {
      solarW = Math.abs(solar.power);
      state.columns.push({ key: 'solar', value: kw(solarW), producing: solarW > 50 });
    }
  }

  if (battery) {
    if (battery.missing || !battery.available) {
      state.columns.push({ key: 'battery', value: '—' });
      state.notes.push(`${battery.name || 'battery'} unreachable`);
    } else {
      battW = typeof battery.power === 'number' ? battery.power : 0; // + charging, − discharging
      const soc = typeof battery.batteryLevel === 'number' ? Math.round(battery.batteryLevel) : null;
      const flow = Math.abs(battW) < 20 ? '' : (battW > 0 ? `+${kw(battW)}` : `−${kw(Math.abs(battW))}`);
      let value;
      if (soc === 100 && Math.abs(battW) < 20) value = 'FULL';
      else if (soc !== null) value = flow ? `${flow} · ${soc}%` : `${soc}%`;
      else value = flow || '—';
      state.columns.push({ key: 'battery', value, soc, low: soc !== null && soc <= 15 });
    }
  }

  if (grid) {
    if (grid.missing || !grid.available || typeof grid.power !== 'number') {
      state.columns.push({ key: 'grid', value: '—' });
      state.notes.push(`${grid.name || 'grid meter'} unreachable`);
    } else {
      gridW = grid.power;
      const value = Math.abs(gridW) < 20 ? '0 W'
        : gridW > 0 ? `${kw(gridW)} ↓` : `${kw(Math.abs(gridW))} ↑`;
      state.columns.push({
        key: 'grid', value,
        flow: Math.abs(gridW) < 20 ? 'idle' : (gridW > 0 ? 'importing' : 'exporting'),
      });
    }
  }


  let consW = null;
  if (consDev && !consDev.missing && consDev.available && typeof consDev.power === 'number') {
    consW = Math.abs(consDev.power);
  } else if (roles.consumption === 'calculated'
             && (solarW !== null || gridW !== null || battW !== null)) {
    consW = Math.max(0, (solarW ?? 0) - (battW ?? 0) + (gridW ?? 0));
  }
  if (consW !== null && evW !== null) consW = Math.max(0, consW - evW);

  const hero = tile.hero === 'solar' && solarW !== null
    ? { value: kw(solarW), label: 'Solar production' }
    : consW !== null
      ? { value: kw(consW), label: 'Home' }
      : solarW !== null
        ? { value: kw(solarW), label: 'Solar production' }
        : { value: '—', label: state.label };

  state.summary = hero.value;
  state.heroLabel = hero.label;

  const compactW = (w) => Math.abs(w) >= 1000
    ? (w / 1000).toFixed(1)
    : `${Math.round(w)}W`;
  const parts = [];
  if (solarW !== null) parts.push(`☀${compactW(solarW)}`);
  const battCol = state.columns.find(c => c.key === 'battery');
  if (battCol && battW !== null) {
    const flow = Math.abs(battW) < 20 ? '' : (battW > 0 ? `+${compactW(battW)}` : `−${compactW(Math.abs(battW))}`);
    const soc = battCol.soc !== undefined && battCol.soc !== null ? `${battCol.soc}%` : '';
    parts.push(`🔋${[flow, soc].filter(Boolean).join('·') || '—'}`);
  } else if (battCol) {
    parts.push('🔋—');
  }
  if (gridW !== null) {
    parts.push(`⚡${Math.abs(gridW) < 20 ? '0' : compactW(Math.abs(gridW)) + (gridW > 0 ? '↓' : '↑')}`);
  }
  if (evW !== null && evW > 50) parts.push(`🔌${compactW(evW)}`);
  state.summaryLine = parts.join(' ');

  if (state.notes.length) {
    state.footer = state.notes.join(' · ');
  } else if (gridW !== null && Math.abs(gridW) < 20 && battW !== null && battW < -20) {
    state.footer = 'Home running fully on battery';
  } else if (battW !== null && battW > 20 && gridW !== null && gridW < -20) {
    state.footer = 'Surplus charging battery, rest exported';
  } else if (gridW !== null && Math.abs(gridW) < 100) {
    state.footer = solarW || battW ? 'Balanced' : '';
  } else if (gridW !== null && gridW < 0) {
    state.footer = 'Exporting surplus';
  } else if (gridW !== null && gridW > 0) {
    state.footer = solarW ? 'Importing — solar below demand' : 'Importing from grid';
  } else {
    state.footer = '';
  }

  state.today = buildEnergyToday(tile, deviceMap, report, { solar, battery, grid, ev });
  state.attention = false;
  state.hasDetail = true;
  return state;
}

const kwh = (v) => `${Number(v).toFixed(1)} kWh`;
const pct = (num, den) => (den > 0.05 ? Math.round(Math.min(1, Math.max(0, num / den)) * 100) : null);

function buildEnergyToday(tile, deviceMap, report, roles) {
  if (!report) return [];
  const rows = [];
  const consDev = deviceMap[(tile.roles || {}).consumption];
  const meterCons = consDev && cap(consDev, 'meter_power.consumption_today');
  const imp = report.importedPeriod || 0;
  const exp = report.exportedPeriod || 0;
  const gen = report.generatedPeriod || 0;
  const chg = report.batteryChargedPeriod || 0;
  const dis = report.batteryDischargedPeriod || 0;
  const ev = report.evChargerChargedPeriod || 0;
  const total = meterCons !== null && meterCons !== undefined ? meterCons : Math.max(0, gen + imp - exp - chg + dis);
  const cons = roles.ev ? Math.max(0, total - ev) : total;

  const selfSuff = pct(total - imp, total);
  rows.push({ key: 'consumption', value: kwh(cons),
    text: `Consumption${selfSuff !== null ? ` · ${selfSuff}% self-sufficient` : ''}`, tone: 'neutral' });
  if (ev > 0.05) rows.push({ key: 'ev', value: kwh(ev), text: 'EV charger', tone: 'neutral' });
  if (roles.solar) {
    const used = pct(gen - exp, gen);
    rows.push({ key: 'solar', value: kwh(gen),
      text: `Solar${used !== null ? ` · ${used}% used at home` : ''}`, tone: gen > 0.05 ? 'amber' : 'neutral' });
  }
  if (roles.battery) rows.push({ key: 'battery', value: `+${Number(chg).toFixed(1)} / −${Number(dis).toFixed(1)} kWh`,
    text: 'Battery · charged / discharged', tone: 'neutral' });
  if (roles.grid) rows.push({ key: 'grid', value: `↓${Number(imp).toFixed(1)} / ↑${Number(exp).toFixed(1)} kWh`,
    text: 'Grid · imported / exported', tone: imp + exp < 0.05 ? 'neutral' : (exp > imp ? 'green' : 'blue') });
  return rows;
}

function buildTileState(tile, deviceMap, report) {
  if (tile.type === 'energy') return buildEnergyState(tile, deviceMap, report);

  const devices = (tile.deviceIds || [])
    .map(id => deviceMap[id]).filter(Boolean).map(summarizeDevice);
  const offline = devices.filter(d => !d.available);
  const live = devices.filter(d => d.available);

  const state = { tileId: tile.id, type: tile.type, label: tile.label, devices };
  if (offline.length) state.footerNote = `${offline.map(d => d.name).join(', ')} unreachable`;

  switch (tile.type) {
    case 'garage': {
      const d = live[0];
      state.summary = d
        ? (d.garageClosed === true ? 'CLOSED' : d.garageClosed === false ? 'OPEN' : 'UNKNOWN')
        : '—';
      state.attention = d ? d.garageClosed === false : false;
      state.openLabel = 'Open garage';
      state.closeLabel = 'Close garage';
      break;
    }
    case 'gate': {
      const d = live[0];
      const isLock = d && typeof d.locked === 'boolean';
      state.summary = !d ? '—'
        : isLock ? (d.locked ? 'LOCKED' : 'UNLOCKED')
        : (d.garageClosed === true ? 'CLOSED' : d.garageClosed === false ? 'OPEN' : 'UNKNOWN');
      state.attention = state.summary === 'UNLOCKED' || state.summary === 'OPEN';
      state.openLabel = 'Open gate';
      state.closeLabel = isLock ? 'Lock gate' : 'Close gate';
      break;
    }
    case 'lock': {
      const unlocked = live.filter(d => d.locked === false);
      state.summary = live.length === 0 ? '—'
        : unlocked.length === 0 ? 'LOCKED' : `${unlocked.length} UNLOCKED`;
      state.attention = unlocked.length > 0;
      break;
    }
    case 'lights': {
      const on = live.filter(d => d.on === true);
      state.summary = `${on.length} ON`;
      state.detailNames = on.map(d => d.name).slice(0, 4);
      break;
    }
    case 'temperature': {
      const temps = live.map(d => d.temperature).filter(t => typeof t === 'number');
      state.summary = temps.length
        ? `${(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)}°` : '—';
      state.humidity = live.map(d => d.humidity).find(h => typeof h === 'number');
      break;
    }
    case 'blinds': {
      const isOpen = (d) =>
        (d.coverState && d.coverState !== 'down') ||
        (typeof d.coverPosition === 'number' && d.coverPosition > 0.05);
      const open = live.filter(isOpen);
      state.summary = live.length === 0 ? '—'
        : open.length === 0 ? 'ALL CLOSED' : `${open.length} OPEN`;
      break;
    }
    case 'contact': {
      const open = live.filter(d => d.contactAlarm === true);
      state.summary = live.length === 0 ? '—'
        : open.length === 0 ? 'ALL CLOSED' : `${open.length} OPEN`;
      state.detailNames = open.map(d => d.name).slice(0, 4);
      state.attention = open.length > 0;
      break;
    }
    default:
      state.summary = '—';
  }
  return state;
}

async function setCover(device, open, setCap) {
  if (!device) throw new Error('Unknown device');
  const caps = device.capabilities || [];
  if (caps.includes('windowcoverings_state')) {
    await setCap(device.id, 'windowcoverings_state', open ? 'up' : 'down');
  } else if (caps.includes('windowcoverings_set')) {
    await setCap(device.id, 'windowcoverings_set', open ? 1 : 0);
  } else {
    throw new Error(`${device.name} has no supported cover capability`);
  }
}

function requireCarToken(homey, token) {
  const cars = homey.app.homey.settings.get('pairedCars') || [];
  const car = token && cars.find(c => c.token === token);
  if (!car) {
    const err = new Error('Unauthorized — pair this car in the Homey app settings');
    err.statusCode = 401;
    throw err;
  }
  const now = Date.now();
  if (!car.lastSeen || now - car.lastSeen > 60 * 1000) {
    car.lastSeen = now;
    homey.app.homey.settings.set('pairedCars', cars);
  }
}

module.exports = {

  async getDashboard({ homey, query }) {
    requireCarToken(homey, query && query.carToken);
    return homey.app.getConfig();
  },

  async getState({ homey, query }) {
    const meta = {
      appVersion: homey.app.homey.manifest.version,
      homeyVersion: homey.app.homey.version,
      homeyName: await homey.app.getHomeyName(),
      ownerName: await homey.app.getOwnerName(),
    };
    requireCarToken(homey, query && query.carToken);
    const config = homey.app.getConfig();
    const deviceMap = await homey.app.getDevices();
    const report = (config.tiles || []).some(t => t.type === 'energy') ? await homey.app.getEnergyToday() : null;
    let home = null;
    try {
      home = { lat: homey.geolocation.getLatitude(), lng: homey.geolocation.getLongitude() };
    } catch (e) { }

    return {
      timestamp: new Date().toISOString(),
      realtime: homey.app.realtimeOk === true,
      home,
      tiles: (config.tiles || []).map(t => Object.assign(buildTileState(t, deviceMap, report), { geofence: t.geofence !== false, auto: !!t.autoAct })),
      scenes: (config.scenes || []).slice().sort((a, b) => String(a.label).localeCompare(String(b.label))),
      meta,
    };
  },

  async postAction({ homey, body }) {
    requireCarToken(homey, body && body.carToken);
    const config = homey.app.getConfig();

    if (body.sceneId) {
      const scene = (config.scenes || []).find(s => s.flowId === body.sceneId);
      if (!scene) throw new Error('Scene not on the car whitelist');
      await homey.app.api.flow.triggerFlow({ id: scene.flowId });
      return { ok: true, ran: scene.label };
    }

    const tile = (config.tiles || []).find(t => t.id === body.tileId);
    if (!tile) throw new Error('Tile not on the car whitelist');
    if (tile.type === 'energy') throw new Error('Energy tile is read-only');

    const deviceMap = await homey.app.getDevices();
    const results = [];
    const setCap = async (deviceId, capabilityId, value) => {
      await homey.app.api.devices.setCapabilityValue({ deviceId, capabilityId, value });
      results.push({ deviceId, capabilityId, value });
    };

    switch (`${tile.type}:${body.action}`) {
      case 'garage:open': {
        await setCap(tile.deviceIds[0], 'garagedoor_closed', false);
        break;
      }
      case 'garage:close': {
        await setCap(tile.deviceIds[0], 'garagedoor_closed', true);
        break;
      }
      case 'gate:open':
      case 'gate:close': {
        const id = tile.deviceIds[0];
        const d = (await homey.app.getDevices())[id];
        if (d && d.capabilities.includes('locked')) {
          await setCap(id, 'locked', body.action === 'close');
        } else {
          await setCap(id, 'garagedoor_closed', body.action === 'close');
        }
        break;
      }
      case 'lock:lock':
      case 'lock:unlock': {
        const value = body.action === 'lock';
        for (const id of tile.deviceIds) await setCap(id, 'locked', value);
        break;
      }
      case 'lights:allOff': {
        for (const id of tile.deviceIds) {
          const d = deviceMap[id];
          if (d?.capabilitiesObj?.onoff?.value === true) await setCap(id, 'onoff', false);
        }
        break;
      }
      case 'lights:setLevel':
      case 'blinds:setLevel': {
        const lvl = Math.max(0, Math.min(1, Number(body.level)));
        const dev = deviceMap[body.deviceId];
        if (!dev) throw new Error('Unknown device');
        if (tile.type === 'blinds') {
          await setCap(dev.id, 'windowcoverings_set', lvl);
        } else {
          await setCap(dev.id, 'dim', lvl);
          if (lvl > 0) { try { await setCap(dev.id, 'onoff', true); } catch (e) {} }
          else { try { await setCap(dev.id, 'onoff', false); } catch (e) {} }
        }
        break;
      }
      case 'lights:toggleDevice': {
        if (!tile.deviceIds.includes(body.deviceId)) throw new Error('Device not on this tile');
        const d = deviceMap[body.deviceId];
        await setCap(d.id, 'onoff', !d.capabilitiesObj?.onoff?.value);
        break;
      }
      case 'blinds:closeAll':
      case 'blinds:openAll': {
        const open = body.action === 'openAll';
        for (const id of tile.deviceIds) await setCover(deviceMap[id], open, setCap);
        break;
      }
      case 'blinds:openDevice':
      case 'blinds:closeDevice': {
        if (!tile.deviceIds.includes(body.deviceId)) throw new Error('Device not on this tile');
        await setCover(deviceMap[body.deviceId], body.action === 'openDevice', setCap);
        break;
      }
      case 'lock:lockDevice':
      case 'lock:unlockDevice': {
        if (!tile.deviceIds.includes(body.deviceId)) throw new Error('Device not on this tile');
        await setCap(body.deviceId, 'locked', body.action === 'lockDevice');
        break;
      }
      default:
        throw new Error(`Unsupported action "${body.action}" for tile type "${tile.type}"`);
    }
    return { ok: true, results };
  },

  async postPair({ homey, body }) {
    const pending = homey.app.homey.settings.get('pairingCode');
    const entered = body && body.code ? String(body.code).trim().toUpperCase() : '';
    if (!pending || entered !== pending.code || Date.now() > pending.expiresAt) {
      if (pending) {
        pending.fails = (pending.fails || 0) + 1;
        if (pending.fails >= 8) {
          homey.app.homey.settings.unset('pairingCode');
          homey.app.log('Pairing code invalidated after repeated failures');
        } else {
          homey.app.homey.settings.set('pairingCode', pending);
        }
      }
      const err = new Error('Invalid or expired pairing code');
      err.statusCode = 401;
      throw err;
    }
    const token = require('crypto').randomBytes(24).toString('hex');
    const cars = homey.app.homey.settings.get('pairedCars') || [];
    cars.push({
      token,
      deviceName: (body.name || 'Car').slice(0, 40),
      customName: null,
      createdAt: new Date().toISOString(),
      meta: body.meta || null,
    });
    homey.app.homey.settings.set('pairedCars', cars);
    homey.app.homey.settings.unset('pairingCode');
    homey.app.log('Car paired:', body.name || 'Car');
    return { token };
  },

  async postCarMeta({ homey, body }) {
    const token = body && body.carToken;
    requireCarToken(homey, token);
    const cars = homey.app.homey.settings.get('pairedCars') || [];
    const car = cars.find(c => c.token === token);
    if (car) {
      car.meta = body.meta || car.meta;
      homey.app.homey.settings.set('pairedCars', cars);
    }
    return { ok: true };
  },

  async postUnpair({ homey, body }) {
    const token = body && body.carToken;
    requireCarToken(homey, token);
    const cars = (homey.app.homey.settings.get('pairedCars') || [])
      .filter(c => c.token !== token);
    homey.app.homey.settings.set('pairedCars', cars);
    homey.app.log('Car unpaired (self-initiated)');
    return { ok: true };
  },

  async getZones({ homey }) {
    const devices = await homey.app.getDevices();
    const names = [...new Set(Object.values(devices)
      .map(d => d.carZoneName).filter(Boolean))];
    const saved = homey.app.homey.settings.get('zoneOrder') || [];
    const known = saved.filter(n => names.includes(n));
    const fresh = names.filter(n => !known.includes(n)).sort((a, b) => a.localeCompare(b));
    return { zones: [...known, ...fresh] };
  },

  async getTimeline({ homey, query }) {
    requireCarToken(homey, query && query.carToken);
    let items = [];
    try {
      const nf = await homey.app.getTimeline();
      items = nf;
    } catch (e) { items = []; }
    return { items };
  },

  async postZoneOrder({ homey, body }) {
    homey.app.homey.settings.set('zoneOrder', (body && body.zones) || []);
    return { ok: true };
  },

  async getPairing({ homey }) {
    const cars = (homey.app.homey.settings.get('pairedCars') || [])
      .map(c => ({
        name: c.customName || c.deviceName || c.name || 'Car',   // display name
        deviceName: c.deviceName || c.name || 'Car',             // original, always visible
        meta: c.meta || null,
        lastSeen: c.lastSeen || null,
        renamed: !!c.customName,
        createdAt: c.createdAt,
        tail: c.token.slice(-4),
      }));
    const pending = homey.app.homey.settings.get('pairingCode');
    let homeyId = null;
    try { homeyId = await homey.app.homey.cloud.getHomeyId(); } catch (e) { }
    return { cars, homeyId, code: pending && Date.now() <= pending.expiresAt ? pending : null };
  },

  async postPairing({ homey, body }) {
    if (body.generate) {
      const code = Array.from({ length: 6 },
        () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
      const pending = { code, expiresAt: Date.now() + 5 * 60 * 1000 };
      homey.app.homey.settings.set('pairingCode', pending);
      return pending;
    }
    if (body.cancelCode) {
      homey.app.homey.settings.unset('pairingCode');
      return { ok: true };
    }
    if (body.renameTail) {
      const cars = homey.app.homey.settings.get('pairedCars') || [];
      const car = cars.find(c => c.token.slice(-4) === body.renameTail);
      if (!car) throw new Error('Unknown car');
      car.customName = (body.name || '').slice(0, 40) || null;   // empty = back to device name
      homey.app.homey.settings.set('pairedCars', cars);
      return { ok: true };
    }
    if (body.revokeTail) {
      const cars = (homey.app.homey.settings.get('pairedCars') || [])
        .filter(c => c.token.slice(-4) !== body.revokeTail);
      homey.app.homey.settings.set('pairedCars', cars);
      return { ok: true };
    }
    throw new Error('Nothing to do');
  },

  async getDevices({ homey }) {
    const deviceMap = await homey.app.getDevices();
    return Object.values(deviceMap).map(d => {
      const caps = d.capabilitiesObj || {};
      const v = (id) => (caps[id] ? caps[id].value : undefined);
      const parts = [];
      if (typeof v('measure_power') === 'number') parts.push(kw(v('measure_power')));
      if (typeof v('measure_battery') === 'number') parts.push(`${Math.round(v('measure_battery'))}%`);
      if (typeof v('measure_temperature') === 'number') parts.push(`${v('measure_temperature').toFixed(1)}°`);
      if (v('garagedoor_closed') !== undefined) parts.push(v('garagedoor_closed') ? 'closed' : 'OPEN');
      if (v('locked') !== undefined) parts.push(v('locked') ? 'locked' : 'UNLOCKED');
      if (v('onoff') !== undefined) parts.push(v('onoff') ? 'on' : 'off');
      if (v('windowcoverings_state') !== undefined) parts.push(v('windowcoverings_state'));
      if (v('alarm_contact') !== undefined) parts.push(v('alarm_contact') ? 'OPEN' : 'closed');
      return {
        id: d.id,
        name: d.name,
        zone: d.carZoneName || d.zoneName || 'No room',
        zoneOrder: (d.carZoneOrder !== undefined ? d.carZoneOrder : 999),
        position: cap(d, 'windowcoverings_set'),
        dim: cap(d, 'dim'),
        class: d.virtualClass || d.class,
        available: d.available !== false,
        capabilities: d.capabilities,
        currentValue: parts.join(' · '),
      };
    });
  },

  async getFlows({ homey }) {
    const flows = await homey.app.api.flow.getFlows();
    return Object.values(flows).map(f => ({ id: f.id, name: f.name, enabled: f.enabled }));
  },

};
