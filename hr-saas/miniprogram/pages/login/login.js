const { req } = require('../../utils/api');

Page({
  data: { employeeNo: '', password: '', loading: false },
  onNoInput(e) { this.setData({ employeeNo: e.detail.value }); },
  onPwdInput(e) { this.setData({ password: e.detail.value }); },
  async onLogin() {
    if (!this.data.employeeNo) { wx.showToast({ title: '请输入工号', icon: 'none' }); return; }
    this.setData({ loading: true });
    try {
      const res = await req('POST', '/auth/login', { employee_no: this.data.employeeNo, password: this.data.password });
      const app = getApp();
      app.globalData.employeeId = res.employee.id;
      app.globalData.employeeNo = res.employee.employee_no;
      app.globalData.name = res.employee.name;
      wx.switchTab({ url: '/pages/channel/channel' });
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
