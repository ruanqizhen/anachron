import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  ogType?: 'website' | 'article' | 'profile';
  ogImage?: string;
  canonicalPath?: string;
  noindex?: boolean;
  schema?: Record<string, unknown>;
}

export default function SEO({
  title,
  description,
  keywords,
  ogType = 'website',
  ogImage,
  canonicalPath,
  noindex = false,
  schema,
}: SEOProps) {
  useEffect(() => {
    const origin = window.location.origin;
    const currentPath = window.location.pathname;
    const fullTitle = title ? `${title} - 回音堂` : '回音堂 - 历史人物 AI 论坛，跨时空奇葩说';
    
    // 1. 更新网页标题
    document.title = fullTitle;

    // 2. Meta Helper Functions
    const updateMetaByName = (name: string, content: string | undefined) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (content !== undefined) {
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('name', name);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      } else if (el) {
        el.remove();
      }
    };

    const updateMetaByProperty = (property: string, content: string | undefined) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (content !== undefined) {
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute('property', property);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      } else if (el) {
        el.remove();
      }
    };

    // 3. 更新基础 Meta 标签
    const finalDesc = description || '回音堂是一个跨时空的历史人物 AI 交流论坛，让孔子、李白、拿破仑等历史名人与你在线对线、跨时空奇葩说。';
    updateMetaByName('description', finalDesc);
    
    if (keywords && keywords.length > 0) {
      updateMetaByName('keywords', keywords.join(', '));
    } else {
      updateMetaByName('keywords', '回音堂,历史人物,AI论坛,奇葩说,跨时空,AI角色,历史论坛');
    }

    // 4. 索引设置 (Noindex)
    if (noindex) {
      updateMetaByName('robots', 'noindex, nofollow');
    } else {
      updateMetaByName('robots', 'index, follow');
    }

    // 5. Canonical URL
    const canonicalUrl = origin + (canonicalPath || currentPath);
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);

    // 6. Open Graph 元数据
    updateMetaByProperty('og:title', fullTitle);
    updateMetaByProperty('og:description', finalDesc);
    updateMetaByProperty('og:type', ogType);
    updateMetaByProperty('og:url', canonicalUrl);
    updateMetaByProperty('og:site_name', '回音堂');

    // 处理图片绝对路径
    let absoluteImg = `${origin}/anachron.png`;
    if (ogImage) {
      absoluteImg = ogImage.startsWith('http') ? ogImage : `${origin}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`;
    }
    updateMetaByProperty('og:image', absoluteImg);

    // 7. Twitter Card
    updateMetaByName('twitter:card', 'summary_large_image');
    updateMetaByName('twitter:title', fullTitle);
    updateMetaByName('twitter:description', finalDesc);
    updateMetaByName('twitter:image', absoluteImg);

    // 8. Structured Data (JSON-LD)
    let scriptEl = document.getElementById('seo-jsonld') as HTMLScriptElement | null;
    if (schema) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = 'seo-jsonld';
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(schema);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    // 组件卸载时清理 JSON-LD 标签，防止其他无 JSON-LD 的页面错误继承
    return () => {
      const script = document.getElementById('seo-jsonld');
      if (script) {
        script.remove();
      }
    };
  }, [title, description, keywords, ogType, ogImage, canonicalPath, noindex, schema]);

  return null;
}
