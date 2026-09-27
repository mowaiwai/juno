const { req } = require('../../utils/api');

Page({
  data: { channels: [], standards: [], loading: true },
  async onShow() {
    if (!getApp().globalData.employeeId) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ loading: true });
    try {
      const channels = await req('GET', '/channel');
      const standards = await Promise.all(
        channels.map((c) => req('GET', `/channel/${c.id}/standard`).catch(() => null)),
      );
      this.setData({ channels, standards: standards.filter(Boolean), loading: false });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
      this.setData({ loading: false });
    }
  },
});
