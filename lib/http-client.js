//@ts-check
import axios from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'

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
    const headers = {
      ...options.headers,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0',
      'Referer': url,
    }
    const csrfTokenCookie = this.jar.getCookiesSync('https://piccoma.com/').find(cookie => cookie.key == 'csrftoken')
    if (csrfTokenCookie != null) {
      headers['X-CSRFToken'] = csrfTokenCookie.value
    }
    return this.client.request({
      ...options,
      url,
      headers,
      withCredentials: true,
    })
  }
}

export default HttpClient