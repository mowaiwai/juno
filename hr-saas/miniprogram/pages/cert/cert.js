const { req } = require('../../utils/api');

Page({
  data: { certs: [], loading: true },
  async onShow() {
    if (!getApp().globalData.employeeId) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ loading: true });
    try {
      const certs = await req('GET', `/cert/employee/${getApp().globalData.employeeId}`);
      this.setData({ certs, loading: false });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
      this.setData({ loading: false });
    }
  },
  async onApply() {
    try {
      const res = await req('POST', '/cert/apply', { employee_id: getApp().globalData.employeeId });
      wx.showToast({ title: res.auto_check.pass ? '已发起' : `未通过: ${res.auto_check.reasons[0]}`, icon: 'none' });
      this.onShow();
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
    }
  },
  async onUpload(e) {
    const certId = e.currentTarget.dataset.id;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: async (res) => {
        const file = res.tempFiles[0];
        await req('POST', '/cert/material', {
          cert_id: certId,
          materials: [{ type: 'file', name: file.name, size: file.size }],
        });
        wx.showToast({ title: '已提交' });
        this.onShow();
      },
    });
  },
});
