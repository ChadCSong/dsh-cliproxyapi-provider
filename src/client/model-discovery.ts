export function modelListingBaseURLs(raw: string): string[] {
  const inputs = raw.trim() === ''
    ? ['http://127.0.0.1:8317', 'http://localhost:8317', 'http://[::1]:8317']
    : [raw.trim()]
  const result: string[] = []
  for (const input of inputs) {
    try {
      const value = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `http://${input}`
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
      url.search = ''
      url.hash = ''
      const rootPath = url.pathname.replace(/\/+$/, '').replace(/\/(?:v1|backend-api)$/i, '')
      url.pathname = `${rootPath}/v1`.replace(/\/{2,}/g, '/')
      const normalized = url.toString().replace(/\/$/, '')
      if (!result.includes(normalized)) result.push(normalized)
    } catch {}
  }
  return result
}
