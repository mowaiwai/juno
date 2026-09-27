const { req } = require('../../utils/api');

Page({
  data: { certs: [], loading: true },
  async onShow() {
    if (!getApp().globalData.employeeId) { wx.redirectTo({ url: '/pages/login/login' }); return; }
    this.setData({ loading: true });
    try {
      const certs = await req('GET', `/cert/employee/${getApp().globalData.employeeId}`);
      this.setData({ certs: certs.filter((c) => ['EXAM', 'DEFENSE_REVIEW'].includes(c.status)), loading: false });
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' });
      this.setData({ loading: false });
    }
  },
  async onTake(e) {
    const certId = e.currentTarget.dataset.cert;
    // MVP: prompt user to contact HR for paper; real impl would list published papers
    wx.showModal({
      title: '在线考试',
      content: '请联系 HR 发布试卷后，在管理端完成考试。',
      showCancel: false,
    });
  },
});
