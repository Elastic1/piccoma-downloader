//@ts-check
const axios = require('axios').default
const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')

class HttpClient {
  constructor(options) {
    this.options = options
    this.jar = new CookieJar()
    this.jar.setCookieSync(`sessionid=${options.sessionid}`, 'https://piccoma.com/')
    this.client = wrapper(axios.create({ jar: this.jar, timeout: options.timeout }))
  }

  get(url) {
    return this.request(url, { method: 'GET' })
  }

  post(url, data) {
    return this.request(url, { method: 'POST', data })
  }

  request(url, options) {
    return this.client.request({
      ...options,
      url,
      headers: {
        ...options.headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0',
        'Referer': url,
      },
      withCredentials: true,
    })
  }
}

module.exports = HttpClient