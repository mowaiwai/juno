// common request helper
function req(method, path, data) {
  const app = getApp();
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.baseUrl + path,
      method,
      data,
      header: {
        'content-type': 'application/json',
        'x-employee-id': app.globalData.employeeId,
      },
      success: (res) => {
        if (res.statusCode >= 400) {
          reject(new Error((res.data && res.data.message) || `HTTP ${res.statusCode}`));
        } else {
          resolve(res.data && res.data.data);
        }
      },
      fail: reject,
    });
  });
}

module.exports = { req };
