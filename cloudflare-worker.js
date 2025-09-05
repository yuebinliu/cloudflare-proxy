// cloudflare-worker.js
export default {
  async fetch(request) {
    const domainMappings = {
      'test.thanx.top': 'http://106.15.4.153:8085',
      'api.thanx.top': 'http://106.15.4.153:8086',
      'admin.thanx.top': 'http://106.15.4.153:8087'
    };

    const url = new URL(request.url);
    const target = domainMappings[url.hostname];
    
    if (!target) {
      return new Response('Domain not configured', { status: 404 });
    }

    // 修改请求头
    const newHeaders = new Headers(request.headers);
    newHeaders.set('X-Forwarded-Host', url.hostname);
    newHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
    newHeaders.delete('host');

    // 转发请求
    const targetUrl = new URL(url.pathname + url.search, target);
    let response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: 'manual' // 手动处理重定向
    });

    // 处理重定向
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location && location.includes(target)) {
        const newLocation = location.replace(target, `https://${url.hostname}`);
        response = new Response(response.body, response);
        response.headers.set('location', newLocation);
        return response;
      }
    }

    // 处理HTML内容，替换链接
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      let html = await response.text();
      
      // 替换所有原始URL为代理域名
      html = html.replace(
        new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        `https://${url.hostname}`
      );
      
      // 替换相对协议URL
      html = html.replace(
        /(src|href)="\/\//g,
        `$1="https://`
      );

      // 返回修改后的响应
      return new Response(html, {
        status: response.status,
        headers: response.headers
      });
    }

    return response;
  }
};
