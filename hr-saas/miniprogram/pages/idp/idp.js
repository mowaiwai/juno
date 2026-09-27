const { req } = require('../../utils/api');

Page({
  data: { idps: [], loading: true },
  async onShow() {
    if (!getApp().globalData.employeeId) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ loading: true });
    try {
      const idps = await req('GET', `/idp?employee_id=${getApp().globalData.employeeId}`);
      this.setData({ idps, loading: false });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
      this.setData({ loading: false });
    }
  },
});
