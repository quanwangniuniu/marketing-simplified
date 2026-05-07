# SEO: `sitemap.xml` 与 `robots.txt` 实施指南（Next.js App Router）

本指南用于完成以下需求：

- 提供 `https://<domain>/sitemap.xml`
- 提供 `https://<domain>/robots.txt`
- 覆盖以下静态入口（不含动态详情页）：
  - `/tasks`
  - `/spreadsheet`
  - `/decisions`
  - `/agent`
  - `/notion`
  - `/meetings`
- 可选：是否包含首页 `/`（按产品确认）
- 所有 URL 必须基于生产域名环境变量，**不要硬编码 localhost**

---

## 1) 先约定环境变量

建议统一使用：

- `NEXT_PUBLIC_SITE_URL`

示例（生产环境）：

```bash
NEXT_PUBLIC_SITE_URL=https://app.mediajira.com
```

> 要求：不带末尾 `/`。  
> 例如写成 `https://app.mediajira.com`，不要写 `https://app.mediajira.com/`。

---

## 2) 新增 `src/app/sitemap.ts`

路径：`frontend/src/app/sitemap.ts`

```ts
import type { MetadataRoute } from 'next';

const getSiteUrl = () => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) {
    throw new Error('Missing NEXT_PUBLIC_SITE_URL for sitemap generation.');
  }
  return raw.replace(/\/+$/, '');
};

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  // 如果产品同意把首页加入 sitemap，可把 '/' 放进数组
  const paths = [
    '/tasks',
    '/spreadsheet',
    '/decisions',
    '/agent',
    '/notion',
    '/meetings',
  ];

  return paths.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: 'weekly',
    priority: 0.7,
    lastModified: new Date(),
  }));
}
```

---

## 3) 新增 `src/app/robots.ts`

路径：`frontend/src/app/robots.ts`

```ts
import type { MetadataRoute } from 'next';

const getSiteUrl = () => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) {
    throw new Error('Missing NEXT_PUBLIC_SITE_URL for robots generation.');
  }
  return raw.replace(/\/+$/, '');
};

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

---

## 4) 部署配置（必须）

在生产部署平台（Vercel / Docker / K8s / CI）中注入：

- `NEXT_PUBLIC_SITE_URL=https://<your-production-domain>`

如果有 preview/staging 环境，也建议各自配置对应域名，避免 `robots.txt` 与 `sitemap.xml` 指向错误域。

---

## 5) 验收步骤（对应 ticket）

部署后检查：

1. 访问 `https://<domain>/sitemap.xml`
   - 返回 200
   - 包含上述 6 个路径（以及可选 `/`）
2. 访问 `https://<domain>/robots.txt`
   - 返回 200
   - `Sitemap:` 行为完整生产 URL，例如  
     `Sitemap: https://app.mediajira.com/sitemap.xml`
3. 抽查路径是否为绝对 URL（不是相对路径，不是 localhost）

可用命令行快速检查：

```bash
curl -s https://<domain>/robots.txt
curl -s https://<domain>/sitemap.xml
```

---

## 6) 常见坑位

- `NEXT_PUBLIC_SITE_URL` 未设置：`sitemap.ts` / `robots.ts` 会报错或生成错误内容。
- URL 末尾有 `/`：容易拼出双斜杠（`//tasks`），已通过 `replace(/\/+$/, '')` 规避。
- 硬编码 `localhost`：生产环境会直接不合规。
- 路径漏掉：记得至少包含 `tasks`、`spreadsheet`、`decisions`、`agent`、`notion`、`meetings`。

---

## 7)（可选）站长平台提交

上线后可在以下平台提交 sitemap：

- [Google Search Console](https://search.google.com/search-console)
- [Bing Webmaster Tools](https://www.bing.com/webmasters)

提交 URL：

- `https://<domain>/sitemap.xml`

---

## 8) 建议的 PR 变更清单

- 新增 `frontend/src/app/sitemap.ts`
- 新增 `frontend/src/app/robots.ts`
- 更新部署文档（本文件或 `frontend/README.md`）说明 `NEXT_PUBLIC_SITE_URL` 为必填环境变量

