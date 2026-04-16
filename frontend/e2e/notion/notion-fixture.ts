export type NotionDraftBlockPayload = {
  id: string;
  type: string;
  order: number;
  content: {
    html?: string;
    language?: string;
    url?: string;
    title?: string;
    description?: string;
    favicon?: string;
    file_url?: string;
    filename?: string;
    file_size?: number;
    content_type?: string;
  };
};

/**
 * Large, realistic marketing snapshot used by Playwright E2E.
 * Each block category appears at least three times (text, headings, quote, code, divider, lists, todos, tables).
 */
export const buildEnglishMarketingBlocks = (): NotionDraftBlockPayload[] => [
  // --- Document framing ---
  {
    id: 'mk-h1-title',
    type: 'heading_1',
    order: 0,
    content: { html: '<h1>Weekly Growth & Acquisition Review — April 16</h1>' },
  },
  {
    id: 'mk-rt-intro-1',
    type: 'rich_text',
    order: 1,
    content: {
      html:
        '<p>This note pulls together paid media, lifecycle touchpoints, and web analytics for the North America pod. Numbers are directional for exec review; finance will lock the official close on Monday.</p>',
    },
  },
  {
    id: 'mk-rt-intro-2',
    type: 'rich_text',
    order: 2,
    content: {
      html:
        '<p>We had a clean push from search and email, while paid social softened on the same creative set we have been running for six weeks. Below is what we shipped, what moved the needle, and what we need from brand by Tuesday.</p>',
    },
  },
  {
    id: 'mk-quote-exec',
    type: 'quote',
    order: 3,
    content: {
      html:
        '<blockquote>Leadership wants proof that creative fatigue is real before we increase production budget — show the decay curve and attach the three concepts we are ready to test.</blockquote>',
    },
  },

  // --- Paid search ---
  {
    id: 'mk-h2-search',
    type: 'heading_2',
    order: 4,
    content: { html: '<h2>Paid search &amp; brand defense</h2>' },
  },
  {
    id: 'mk-h3-search-geo',
    type: 'heading_3',
    order: 5,
    content: { html: '<h3>Geo split &amp; match-type hygiene</h3>' },
  },
  {
    id: 'mk-rt-search-1',
    type: 'rich_text',
    order: 6,
    content: {
      html:
        '<p>Brand campaigns in the US and Canada held efficiency; generic prospecting in the UK dipped after competitor promos went live midweek. We tightened exact-match clusters on high-intent terms and added two new RSA variants focused on shipping speed.</p>',
    },
  },
  {
    id: 'mk-code-sql-spend',
    type: 'code',
    order: 7,
    content: {
      html:
        'SELECT campaign_id,\n       DATE(report_date) AS day,\n       SUM(cost_usd) AS spend,\n       SUM(conversions_purchase) AS conv\nFROM ads_search_daily\nWHERE report_date >= CURRENT_DATE - INTERVAL \'14 days\'\n  AND channel = \'SEARCH\'\nGROUP BY 1, 2\nORDER BY day DESC, spend DESC\nLIMIT 500;',
      language: 'sql',
    },
  },
  {
    id: 'mk-list-search-actions',
    type: 'list',
    order: 8,
    content: {
      html:
        '<ul><li>Pause the underperforming DSA ad group tied to outdated PDP copy.</li><li>Move 8% of budget from generic UK to resilient US brand terms until CAC stabilizes.</li><li>Share the RSA copy deck with translations before Friday localization freeze.</li></ul>',
    },
  },
  {
    id: 'mk-divider-1',
    type: 'divider',
    order: 9,
    content: { html: '<hr />' },
  },

  // --- Paid social ---
  {
    id: 'mk-h2-social',
    type: 'heading_2',
    order: 10,
    content: { html: '<h2>Paid social &amp; creative pipeline</h2>' },
  },
  {
    id: 'mk-h3-creative',
    type: 'heading_3',
    order: 11,
    content: { html: '<h3>Creative rotation &amp; hook testing</h3>' },
  },
  {
    id: 'mk-rt-social-1',
    type: 'rich_text',
    order: 12,
    content: {
      html:
        '<p>TikTok and Meta both showed higher frequency and rising CPMs. Short UGC hooks still beat polished studio cuts for sign-up volume, but we are short on compliant variants for the May sustainability push.</p>',
    },
  },
  {
    id: 'mk-num-social-steps',
    type: 'numbered_list',
    order: 13,
    content: {
      html:
        '<ol><li>Ship three net-new UGC scripts from creators A–C by Wednesday noon PT.</li><li>Upload winning hooks into Meta Advantage+ with a 70/30 budget split vs. legacy carousel.</li><li>Tuesday stand-up: review hook-level retention from first three seconds of view.</li></ol>',
    },
  },
  {
    id: 'mk-table-social',
    type: 'table',
    order: 14,
    content: {
      html:
        '<table data-table-block="true" style="table-layout: fixed; width: 100%;"><tbody><tr><th>Platform</th><th>7d spend (USD)</th><th>CPA vs. target</th><th>Comment</th></tr><tr><td>Meta</td><td>18,420</td><td>+6%</td><td>Frequency creeping; refresh urgent</td></tr><tr><td>TikTok</td><td>9,905</td><td>+11%</td><td>UGC outperforming branded</td></tr><tr><td>Pinterest</td><td>2,130</td><td>−4%</td><td>Steady; not a volume driver</td></tr></tbody></table>',
    },
  },
  {
    id: 'mk-quote-pm',
    type: 'quote',
    order: 15,
    content: {
      html:
        '<blockquote>Product marketing asked for one paragraph on why we are not scaling Pinterest yet — keep it crisp and avoid blaming the channel; frame it as prioritized learnings.</blockquote>',
    },
  },
  {
    id: 'mk-todo-1',
    type: 'todo_list',
    order: 16,
    content: {
      html:
        '<span data-todo-state="unchecked"></span>Approve the creative matrix spreadsheet and tag owners in Asana.',
    },
  },
  {
    id: 'mk-todo-2',
    type: 'todo_list',
    order: 17,
    content: {
      html:
        '<span data-todo-state="unchecked"></span>Send Meta placement breakdown (Reels vs. Feed) to the growth channel.',
    },
  },

  // --- Lifecycle & site ---
  {
    id: 'mk-h1-lifecycle',
    type: 'heading_1',
    order: 18,
    content: { html: '<h1>Lifecycle, onsite, and instrumentation</h1>' },
  },
  {
    id: 'mk-h3-email',
    type: 'heading_3',
    order: 19,
    content: { html: '<h3>Email &amp; in-app prompts</h3>' },
  },
  {
    id: 'mk-rt-life-1',
    type: 'rich_text',
    order: 20,
    content: {
      html:
        '<p>Welcome and cart sequences beat control on opens; the bottleneck is mobile landing parity after the recent nav experiment. We added a staging checklist so new email deep links are smoke-tested on iOS Safari before send.</p>',
    },
  },
  {
    id: 'mk-list-email-bullets',
    type: 'list',
    order: 21,
    content: {
      html:
        '<ul><li>Cart recovery: lift came from clearer shipping cut-off messaging, not deeper discounts.</li><li>Win-back cohort: pause the third touch if no site visit in 72 hours — spam complaints ticked up.</li><li>In-app nudge: shorten body copy; CTR improved when we matched push tone to email subject lines.</li></ul>',
    },
  },
  {
    id: 'mk-code-bash-deploy',
    type: 'code',
    order: 22,
    content: {
      html:
        '#!/usr/bin/env bash\nset -euo pipefail\necho ">>> Preflight email deep links"\nnpm run test:e2e -- --grep @deeplink\necho ">>> Deploy feature flags (staged)"\n./scripts/flags rollout email_nav_v2 --percent 25 --region NA',
      language: 'bash',
    },
  },
  {
    id: 'mk-num-email-checklist',
    type: 'numbered_list',
    order: 23,
    content: {
      html:
        '<ol><li>QA all utm_* combinations against the Monday reporting spec.</li><li>Confirm unsubscribe footer renders on dark mode clients.</li><li>Archive control vs. variant screenshots in the shared drive.</li></ol>',
    },
  },
  {
    id: 'mk-divider-2',
    type: 'divider',
    order: 24,
    content: { html: '<hr />' },
  },
  {
    id: 'mk-h2-site',
    type: 'heading_2',
    order: 25,
    content: { html: '<h2>Site performance &amp; experiments</h2>' },
  },
  {
    id: 'mk-h3-webvitals',
    type: 'heading_3',
    order: 26,
    content: { html: '<h3>Core Web Vitals snapshot</h3>' },
  },
  {
    id: 'mk-table-web',
    type: 'table',
    order: 27,
    content: {
      html:
        '<table data-table-block="true" style="table-layout: fixed; width: 100%;"><tbody><tr><th>Page template</th><th>LCP p75 (s)</th><th>INP p75 (ms)</th><th>Owner</th></tr><tr><td>Product detail</td><td>2.3</td><td>168</td><td>Web perf</td></tr><tr><td>Category hub</td><td>2.9</td><td>201</td><td>Content platform</td></tr><tr><td>Checkout</td><td>1.8</td><td>142</td><td>Commerce</td></tr></tbody></table>',
    },
  },
  {
    id: 'mk-quote-analytics',
    type: 'quote',
    order: 28,
    content: {
      html:
        '<blockquote>Analytics wants a single event name for “add to cart” across web and app — duplicate firing from the mini-cart is still inflating funnel reports by low single digits.</blockquote>',
    },
  },
  {
    id: 'mk-code-json-pixel',
    type: 'code',
    order: 29,
    content: {
      html:
        '{\n  "event": "add_to_cart",\n  "source": "web",\n  "sku": "SKU-48921",\n  "currency": "USD",\n  "value": 129.0,\n  "dedupe_key": "cart:session-7f3a9c"\n}',
      language: 'json',
    },
  },
  {
    id: 'mk-todo-3',
    type: 'todo_list',
    order: 30,
    content: {
      html:
        '<span data-todo-state="unchecked"></span>Pair with analytics to validate the dedupe_key rollout in staging.',
    },
  },

  // --- Risks & next week ---
  {
    id: 'mk-h2-risks',
    type: 'heading_2',
    order: 31,
    content: { html: '<h2>Risks, dependencies, and next week</h2>' },
  },
  {
    id: 'mk-h3-risks',
    type: 'heading_3',
    order: 32,
    content: { html: '<h3>Open risks</h3>' },
  },
  {
    id: 'mk-list-risks',
    type: 'list',
    order: 33,
    content: {
      html:
        '<ul><li>Legal review may slip the new promo copy for the Canada daypart — have a generic fallback banner.</li><li>Data pipeline delay on Sunday could shift Monday morning dashboards by up to two hours.</li><li>Creator talent availability may push the UGC shoot if weather disrupts the location block.</li></ul>',
    },
  },
  {
    id: 'mk-num-week-priorities',
    type: 'numbered_list',
    order: 34,
    content: {
      html:
        '<ol><li>Lock the cross-channel budget reallocation memo before the exec sync.</li><li>Publish the creative refresh timeline with named approvers.</li><li>Run a single source-of-truth check between CRM export and ads audience sizes.</li></ol>',
    },
  },
  {
    id: 'mk-table-owners',
    type: 'table',
    order: 35,
    content: {
      html:
        '<table data-table-block="true" style="table-layout: fixed; width: 100%;"><tbody><tr><th>Workstream</th><th>DRI</th><th>Due</th><th>Status</th></tr><tr><td>Creative refresh</td><td>Maya</td><td>Apr 18</td><td>On track</td></tr><tr><td>Tracking dedupe</td><td>Jordan</td><td>Apr 19</td><td>In progress</td></tr><tr><td>Regional budget memo</td><td>Alex</td><td>Apr 17</td><td>At risk</td></tr></tbody></table>',
    },
  },
  {
    id: 'mk-rt-closing',
    type: 'rich_text',
    order: 36,
    content: {
      html:
        '<p>If anything here conflicts with the finance spreadsheet version from yesterday afternoon, treat finance as canonical and ping me so we can reconcile the narrative before it goes wider.</p>',
    },
  },
  {
    id: 'mk-divider-3',
    type: 'divider',
    order: 37,
    content: { html: '<hr />' },
  },
  {
    id: 'mk-h1-appendix',
    type: 'heading_1',
    order: 38,
    content: { html: '<h1>Appendix — definitions &amp; tags</h1>' },
  },
  {
    id: 'mk-h3-glossary',
    type: 'heading_3',
    order: 39,
    content: { html: '<h3>Glossary</h3>' },
  },
  {
    id: 'mk-rt-appendix',
    type: 'rich_text',
    order: 40,
    content: {
      html:
        '<p><strong>CAC</strong> is fully loaded against attributed purchases in a 7-day click window. <strong>ROAS</strong> references platform-reported revenue, not margin. Tags in our project tracker follow <code>team-channel-priority</code> (for example, <code>growth-meta-P1</code>).</p>',
    },
  },
  {
    id: 'mk-img-marketing-github',
    type: 'image',
    order: 41,
    content: {
      file_url: '/notion-fixtures/marketing-simplified-github-screenshot.png',
      filename: 'marketing-simplified GitHub repository',
      content_type: 'image/png',
    },
  },
  {
    id: 'mk-web-marketing-simplified-repo',
    type: 'web_bookmark',
    order: 42,
    content: {
      url: 'https://github.com/quanwangniuniu/marketing-simplified',
      title: 'quanwangniuniu/marketing-simplified',
      description: 'GitHub · marketing-simplified',
      favicon: '',
    },
  },
  {
    id: 'mk-file-sample-attachment',
    type: 'file',
    order: 43,
    content: {
      file_url: '/notion-fixtures/e2e-sample-attachment.txt',
      filename: 'e2e-sample-attachment.txt',
      content_type: 'text/plain',
    },
  },
];
