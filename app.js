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


const Homey = require('homey');
const { HomeyAPI } = require('homey-api');

class CarDashboardApp extends Homey.App {

  async onInit() {
    this.log('Car Dashboard app starting…');

    this.api = await HomeyAPI.createAppAPI({ homey: this.homey });

    this.realtimeOk = false;

    try {
      await this.api.devices.connect();
      this.realtimeOk = true;
      this.log('Realtime device subscription ACTIVE');
      this.api.devices.on('device.update', (device) => {
        const config = this.getConfig();
        const watched = new Set(
          (config.tiles || []).flatMap(t => t.deviceIds || [])
        );
        if (watched.has(device.id)) {
          this.homey.api.realtime('tileUpdate', { deviceId: device.id });
        }
      });
    } catch (err) {
      this.realtimeOk = false;
      this.error('*** REALTIME SUBSCRIPTION FAILED — /state may serve stale values without fresh fetches ***');
      this.error('Reason:', err.message);
    }

    this.log('Car Dashboard app ready.');
  }

  getConfig() {
    return this.homey.settings.get('dashboard') || { tiles: [], scenes: [] };
  }

  async getEnergyToday() {
    const now = Date.now();
    if (this.energyCache && now - this.energyCache.at < 60000) return this.energyCache.report;
    let report = null;
    try {
      const tz = this.homey.clock.getTimezone();
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
      const fresh = await HomeyAPI.createAppAPI({ homey: this.homey });
      report = (await fresh.energy.getReportDay({ date })).electricity || null;
    } catch (err) {
      this.error('Energy report unavailable:', err && err.message);
    }
    this.energyCache = { at: now, report };
    return report;
  }

  async getDevices() {
    const fresh = await HomeyAPI.createAppAPI({ homey: this.homey });
    const devices = await fresh.devices.getDevices();
    try {
      const zones = await fresh.zones.getZones();
      const saved = this.homey.settings.get('zoneOrder') || [];
      const orderOf = {};
      saved.forEach((n, i) => { orderOf[n] = i; });
      for (const d of Object.values(devices)) {
        try {
          d.carZoneName = (d.zone && zones[d.zone] && zones[d.zone].name) || '';
          d.carZoneOrder = (orderOf[d.carZoneName] !== undefined) ? orderOf[d.carZoneName] : 999;
        } catch (e) { }
      }
    } catch (err) {
      this.error('Zone names unavailable (non-fatal):', err && err.message);
    }
    return devices;
  }

}


CarDashboardApp.prototype.getHomeyName = async function () {
  try {
    const name = await this.homey.cloud.getHomeyName?.();
    if (name) return name;
  } catch (e) {}
  try {
    const sys = await this.homey.api.get?.('/manager/system/');
    if (sys && sys.hostname) return sys.hostname;
  } catch (e) {}
  return '';
};

CarDashboardApp.prototype.getOwnerName = async function () {
  try {
    const me = await this.homey.api.get?.('/manager/users/user/me');
    if (me && me.name) return me.name;
  } catch (e) {}
  return '';
};

CarDashboardApp.prototype.getTimeline = async function () {
  try {
    const res = await this.homey.api.get?.('/manager/notifications/notification');
    const list = Array.isArray(res) ? res : Object.values(res || {});
    return list
      .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
      .slice(0, 30)
      .map(n => {
        let t = String(n.excerpt || '')
          .replace(/[*_]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (t.length > 140) t = t.slice(0, 139).trimEnd() + '…';
        return { text: t, at: n.dateCreated };
      });
  } catch (e) { return []; }
};

module.exports = CarDashboardApp;
