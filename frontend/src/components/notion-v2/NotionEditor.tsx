'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EditorBlock, NotionBlockType } from '@/types/notion';
import { NotionDraftAPI } from '@/lib/api/notionDraftApi';
import useOutline from '@/hooks/useOutline';
import OutlineOverlay from './OutlineOverlay';
import { toast } from 'react-hot-toast';
import {
  Plus,
  GripVertical,
  Trash2,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Minus,
  List,
  ListOrdered,
  CheckSquare,
  Table2,
  Image as ImageIcon,
  Video,
  Volume2,
  Paperclip,
  Bookmark,
} from 'lucide-react';

type Command = 'bold' | 'italic' | 'underline' | 'link';

interface NotionEditorProps {
  blocks: EditorBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<EditorBlock[]>>;
  draftId?: number;
}

const blockLabels: Record<NotionBlockType | string, string> = {
  rich_text: 'Text',
  text: 'Text',
  heading: 'Heading',
  quote: 'Quote',
  code: 'Code',
  divider: 'Divider',
  list: 'Bulleted list',
  numbered_list: 'Numbered list',
  todo_list: 'To-do list',
  table: 'Table',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  file: 'File',
  web_bookmark: 'Web bookmark',
};



const createBlockId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `block_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
};

const TABLE_TEMPLATE = `
<table data-table-block="true" style="table-layout: fixed; width: 100%;">
  <tbody>
    ${Array.from({ length: 3 })
      .map(
        () => `
      <tr>
        ${Array.from({ length: 3 })
          .map(() => '<td style="width: 33.33%; min-width: 200px; max-width: none;"><br></td>')
          .join('')}
      </tr>
    `
      )
      .join('')}
  </tbody>
</table>
`;

const addRowToTableHtml = (html: string) => {
  if (typeof document === 'undefined') return html;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html || TABLE_TEMPLATE;
  let table = tempDiv.querySelector('table');
  if (!table) {
    tempDiv.innerHTML = TABLE_TEMPLATE;
    table = tempDiv.querySelector('table');
    if (!table) return html;
  }
  table.setAttribute('data-table-block', 'true');
  // Ensure table-layout: fixed
  (table as HTMLElement).style.tableLayout = 'fixed';
  (table as HTMLElement).style.width = 'auto';
  
  const firstRow = table.querySelector('tr');
  if (!firstRow) return html;
  
  const columnCount = firstRow.children.length;
  const newRow = document.createElement('tr');
  for (let i = 0; i < columnCount; i += 1) {
    const cell = document.createElement('td');
    cell.innerHTML = '<br>';
    // Preserve column width from first row
    const firstCell = firstRow.children[i] as HTMLElement;
    if (firstCell && firstCell.style.width) {
      (cell as HTMLElement).style.width = firstCell.style.width;
      (cell as HTMLElement).style.minWidth = firstCell.style.minWidth || firstCell.style.width;
    } else {
      // Default width if not set
      (cell as HTMLElement).style.width = '200px';
      (cell as HTMLElement).style.minWidth = '200px';
    }
    newRow.appendChild(cell);
  }
  const tbody = table.querySelector('tbody') || table;
  tbody.appendChild(newRow);
  return table.outerHTML;
};

const addColumnToTableHtml = (html: string) => {
  if (typeof document === 'undefined') return html;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html || TABLE_TEMPLATE;
  let table = tempDiv.querySelector('table');
  if (!table) {
    tempDiv.innerHTML = TABLE_TEMPLATE;
    table = tempDiv.querySelector('table');
    if (!table) return html;
  }
  table.setAttribute('data-table-block', 'true');
  // Ensure table-layout: fixed
  (table as HTMLElement).style.tableLayout = 'fixed';
  // When adding a column, set width to auto to allow table to grow beyond container
  (table as HTMLElement).style.width = 'auto';
  (table as HTMLElement).style.setProperty('width', 'auto', 'important');
  
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return html;
  
  // Always use initial width (200px) for new columns
  const newColumnWidth = '200px';
  
  rows.forEach((row) => {
    const cell = document.createElement('td');
    cell.innerHTML = '<br>';
    // Set width to initial width
    (cell as HTMLElement).style.width = newColumnWidth;
    (cell as HTMLElement).style.minWidth = newColumnWidth;
    row.appendChild(cell);
  });
  return table.outerHTML;
};

export const createEmptyBlock = (
  type: NotionBlockType | string = 'rich_text',
  content?: Record<string, any>
): EditorBlock => {
  let html = '';
  let language: string | undefined;
  if (type === 'todo_list') {
    html = '<span data-todo-state="unchecked"></span>';
  } else if (type === 'divider') {
    html = '<hr />';
  } else if (type === 'table') {
    html = TABLE_TEMPLATE;
  } else if (type === 'code') {
    html = '';
    language = content?.language || 'plain';
  } else if (type === 'image' && content?.file_url) {
    html = `<img src="${content.file_url}" alt="${content.filename || 'Image'}" style="max-width: 100%; height: auto;" />`;
  } else if (type === 'video' && content?.file_url) {
    html = `<video src="${content.file_url}" controls preload="auto" playsinline muted style="max-width: 100%; width: 100%; height: auto; display: block;" onloadeddata="this.currentTime=0.01; setTimeout(() => { this.currentTime=0; this.muted=false; }, 100);"></video>`;
  } else if (type === 'audio' && content?.file_url) {
    html = `<audio src="${content.file_url}" controls style="width: 100%;"></audio>`;
  } else if (type === 'file' && content?.file_url) {
    html = `<a href="${content.file_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 p-3 border border-gray-200 rounded-md hover:bg-gray-50">
      <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <span>${content.filename || 'File'}</span>
    </a>`;
  } else if (type === 'web_bookmark' && content?.url) {
    html = `<div class="border border-gray-200 rounded-md p-4 hover:bg-gray-50">
      <a href="${content.url}" target="_blank" rel="noopener noreferrer" class="block">
        ${content.favicon ? `<img src="${content.favicon}" alt="" class="w-4 h-4 inline-block mr-2" />` : ''}
        <div class="font-medium text-gray-900">${content.title || content.url}</div>
        ${content.description ? `<div class="text-sm text-gray-500 mt-1">${content.description}</div>` : ''}
      </a>
    </div>`;
  }
  return {
    id: createBlockId(),
    type,
    html,
    ...(language !== undefined && { language }),
  };
};

const placeCaretAtEnd = (element: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.addRange(range);
};

const sanitizeHtml = (value: string) => {
  if (!value) return '';
  return value.replace(/<script.*?>.*?<\/script>/gi, '');
};

const TODO_STATE_ATTR_REGEX = /data-todo-state="(checked|unchecked)"/i;
const TODO_MARKER_SPAN_REGEX = /<span[^>]*data-todo-state="(checked|unchecked)"[^>]*><\/span>/i;

const ensureTodoMarker = (html: string, checked = false) => {
  if (TODO_STATE_ATTR_REGEX.test(html)) {
    return html;
  }
  const marker = `<span data-todo-state="${checked ? 'checked' : 'unchecked'}"></span>`;
  return `${marker}${html || '<br>'}`;
};

const removeTodoMarker = (html: string) => html.replace(TODO_MARKER_SPAN_REGEX, '');

const setTodoStateInHtml = (html: string, checked: boolean) => {
  const state = checked ? 'checked' : 'unchecked';
  if (TODO_STATE_ATTR_REGEX.test(html)) {
    return html.replace(TODO_STATE_ATTR_REGEX, `data-todo-state="${state}"`);
  }
  const marker = `<span data-todo-state="${state}"></span>`;
  return `${marker}${html || '<br>'}`;
};

const isTodoCheckedInHtml = (html: string) => html.includes('data-todo-state="checked"');

const isEmptyHtml = (value: string) => {
  if (!value) return true;
  return sanitizeHtml(value)
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<div><\/div>/gi, '')
    .replace(TODO_MARKER_SPAN_REGEX, '')
    .replace(/\s+/g, '')
    .trim() === '';
};

const sanitizeHtmlContent = (html: string): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const allowedTags = [
    'p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre', 'span', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'video', 'audio', 'source', 'svg', 'path',
  ];
  const allowedAttributes: Record<string, string[]> = {
    a: ['href', 'target', 'rel', 'class'],
    span: ['style', 'data-todo-state', 'class'],
    table: ['data-table-block'],
    img: ['src', 'alt', 'style', 'class'],
    video: ['src', 'controls', 'preload', 'playsinline', 'muted', 'style', 'class', 'onloadeddata'],
    audio: ['src', 'controls', 'style', 'class'],
    div: ['class', 'style'],
    svg: ['class', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
    path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
  };

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      if (!allowedTags.includes(tagName)) {
        const fragment = document.createDocumentFragment();
        Array.from(element.childNodes).forEach((child) => {
          const cleaned = cleanNode(child);
          if (cleaned) {
            fragment.appendChild(cleaned);
          }
        });
        return fragment.childNodes.length > 0 ? fragment : null;
      }

      const newElement = document.createElement(tagName);
      const allowedAttrs = allowedAttributes[tagName] || [];
      Array.from(element.attributes).forEach((attr) => {
        if (allowedAttrs.includes(attr.name.toLowerCase())) {
          newElement.setAttribute(attr.name, attr.value);
        }
      });

      if (tagName === 'a') {
        const href = element.getAttribute('href');
        if (href) {
          newElement.setAttribute('href', href);
          newElement.setAttribute('target', '_blank');
          newElement.setAttribute('rel', 'noopener noreferrer');
        }
      }

      Array.from(element.childNodes).forEach((child) => {
        const cleaned = cleanNode(child);
        if (cleaned) {
          newElement.appendChild(cleaned);
        }
      });

      return newElement;
    }

    return null;
  };

  const cleanedFragment = document.createDocumentFragment();
  Array.from(tempDiv.childNodes).forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) {
      cleanedFragment.appendChild(cleaned);
    }
  });

  const wrapper = document.createElement('div');
  wrapper.appendChild(cleanedFragment);
  return wrapper.innerHTML;
};

const getBlockClassName = (type: NotionBlockType | string) => {
  switch (type) {
    case 'heading_1':
    case 'h1':
      return 'text-4xl font-bold leading-tight';
    case 'heading_2':
    case 'h2':
      return 'text-3xl font-semibold leading-tight';
    case 'heading_3':
    case 'h3':
      return 'text-2xl font-semibold leading-tight';
    case 'heading':
      // Fallback for old heading type
      return 'text-2xl font-semibold leading-tight';
    case 'quote':
      return 'border-l-4 border-gray-300 pl-4 italic text-gray-700';
    case 'code':
      return 'font-mono text-sm bg-gray-900 rounded-md px-4 py-4 overflow-x-auto';
    case 'table':
      return 'text-base leading-7 [&_table]:border-collapse [&_table]:table-fixed [&_table]:rounded-md [&_table]:w-full [&_td]:border [&_td]:border-gray-200 [&_td]:p-2 [&_td]:align-top [&_td]:min-w-[200px] [&_td]:relative [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:p-2 [&_th]:relative [&_td:hover_.column-resize-handle]:bg-[#3CCED7]/80 [&_td:hover_.column-resize-handle]:opacity-60';
    case 'list':
    case 'numbered_list':
    case 'todo_list':
      return 'text-base leading-7';
    case 'image':
      return 'my-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md';
    case 'video':
      return 'my-4 [&_video]:max-w-full [&_video]:w-full [&_video]:h-auto [&_video]:rounded-md [&_video]:block [&_video]:bg-black [&_video]:min-h-[200px]';
    case 'audio':
      return 'my-4 [&_audio]:w-full';
    case 'file':
      return 'my-4';
    case 'web_bookmark':
      return 'my-4';
    default:
      return 'text-base leading-7';
  }
};

const isTextBlock = (type: NotionBlockType | string) => 
  type !== 'divider' && 
  type !== 'image' && 
  type !== 'video' && 
  type !== 'audio' && 
  type !== 'file' && 
  type !== 'web_bookmark' &&
  type !== 'code';

// Highlight code using highlight.js (lazy loaded)
let hljsModule: any = null;
const loadHighlightJs = () => {
  if (hljsModule) return Promise.resolve(hljsModule);
  return import('highlight.js').then((module) => {
    hljsModule = module.default || module;
    return hljsModule;
  }).catch((error) => {
    console.warn('Failed to load highlight.js:', error);
    return null;
  });
};

const highlightCode = (code: string, language?: string): string => {
  if (!code || !code.trim()) return '';
  
  // If hljs is not loaded yet, return plain code (will be highlighted when loaded)
  if (!hljsModule) {
    // Trigger async load
    loadHighlightJs();
    return code;
  }
  
  try {
    // If language is specified, use it
    if (language && language !== 'plain' && language !== 'text') {
      const result = hljsModule.highlight(code, { language });
      return result.value;
    }
    
    // Otherwise, try to auto-detect
    const result = hljsModule.highlightAuto(code);
    return result.value;
  } catch (error) {
    // If highlighting fails, return plain text
    console.warn('Code highlighting failed:', error);
    return code;
  }
};

// Common programming languages for language selector
const commonLanguages = [
  { value: 'plain', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'nginx', label: 'Nginx' },
];

// Language name mapping from highlight.js to our language values
const languageMap: Record<string, string> = {
  'js': 'javascript',
  'javascript': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'typescript': 'typescript',
  'tsx': 'typescript',
  'c++': 'cpp',
  'cpp': 'cpp',
  'cxx': 'cpp',
  'cc': 'cpp',
  'c': 'c',
  'html': 'html',
  'xml': 'xml',
  'htm': 'html',
  'xhtml': 'html',
  'css': 'css',
  'json': 'json',
  'python': 'python',
  'py': 'python',
  'py3': 'python',
  'sql': 'sql',
  'mysql': 'sql',
  'postgresql': 'sql',
  'pgsql': 'sql',
  'java': 'java',
  'csharp': 'csharp',
  'cs': 'csharp',
  'php': 'php',
  'ruby': 'ruby',
  'rb': 'ruby',
  'go': 'go',
  'golang': 'go',
  'rust': 'rust',
  'rs': 'rust',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'kt': 'kotlin',
  'scss': 'scss',
  'sass': 'scss',
  'yaml': 'yaml',
  'yml': 'yaml',
  'markdown': 'markdown',
  'md': 'markdown',
  'bash': 'bash',
  'sh': 'bash',
  'shell': 'shell',
  'zsh': 'shell',
  'dockerfile': 'dockerfile',
  'nginx': 'nginx',
};

// Auto-detect language for code blocks
const detectLanguage = (code: string): string => {
  if (!code || !code.trim() || !hljsModule) return 'plain';
  
  try {
    // Use highlightAuto with subset of languages for better accuracy
    const result = hljsModule.highlightAuto(code, [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'html', 'css', 'scss',
      'json', 'xml', 'yaml', 'markdown', 'sql', 'bash', 'shell', 'dockerfile', 'nginx'
    ]);
    
    const detectedLang = result.language || 'plain';
    
    if (detectedLang === 'plain') {
      return 'plain';
    }
    
    // Map highlight.js language names to our language values
    const lowerLang = detectedLang.toLowerCase();
    const mappedLang = languageMap[lowerLang] || lowerLang;
    
    // Verify the mapped language exists in our common languages
    const isValid = commonLanguages.some(lang => lang.value === mappedLang);
    
    if (isValid) {
      return mappedLang;
    }
    
    // Try direct match if mapping failed
    const directMatch = commonLanguages.find(lang => lang.value === lowerLang);
    if (directMatch) {
      return directMatch.value;
    }
    
    // If still not found, try to find by partial match
    const partialMatch = commonLanguages.find(lang => 
      lowerLang.includes(lang.value) || lang.value.includes(lowerLang)
    );
    if (partialMatch) {
      return partialMatch.value;
    }
    
    return 'plain';
  } catch (error) {
    console.warn('Language detection failed:', error);
    return 'plain';
  }
};

interface CommandOption {
  id: string;
  label: string;
  icon?: string | React.ReactNode;
  type: NotionBlockType | string;
  description?: string;
}

const basicBlocks: CommandOption[] = [
  { id: 'text', label: 'Text', icon: <Type className="w-[18px] h-[18px]" />, type: 'rich_text', description: 'Just start writing with plain text.' },
  { id: 'h1', label: 'Heading 1', icon: <Heading1 className="w-[18px] h-[18px]" />, type: 'heading_1', description: 'Big section heading.' },
  { id: 'h2', label: 'Heading 2', icon: <Heading2 className="w-[18px] h-[18px]" />, type: 'heading_2', description: 'Medium section heading.' },
  { id: 'h3', label: 'Heading 3', icon: <Heading3 className="w-[18px] h-[18px]" />, type: 'heading_3', description: 'Small section heading.' },
  { id: 'quote', label: 'Quote', icon: <Quote className="w-[18px] h-[18px]" />, type: 'quote', description: 'Capture a quote.' },
  { id: 'code', label: 'Code', icon: <Code className="w-[18px] h-[18px]" />, type: 'code', description: 'Capture a code snippet.' },
  { id: 'divider', label: 'Divider', icon: <Minus className="w-[18px] h-[18px]" />, type: 'divider', description: 'Visually divide blocks.' },
  { id: 'list', label: 'Bulleted list', icon: <List className="w-[18px] h-[18px]" />, type: 'list', description: 'Create a simple bulleted list.' },
  { id: 'numbered_list', label: 'Numbered list', icon: <ListOrdered className="w-[18px] h-[18px]" />, type: 'numbered_list', description: 'Create an ordered list.' },
  { id: 'todo_list', label: 'To-do list', icon: <CheckSquare className="w-[18px] h-[18px]" />, type: 'todo_list', description: 'Track tasks with checkboxes.' },
  { id: 'table', label: 'Table', icon: <Table2 className="w-[18px] h-[18px]" />, type: 'table', description: 'Insert a simple grid for structured data.' },
];

const mediaBlocks: CommandOption[] = [
  { id: 'image', label: 'Image', icon: <ImageIcon className="w-[18px] h-[18px]" />, type: 'image', description: 'Upload or embed an image.' },
  { id: 'video', label: 'Video', icon: <Video className="w-[18px] h-[18px]" />, type: 'video', description: 'Upload or embed a video.' },
  { id: 'audio', label: 'Audio', icon: <Volume2 className="w-[18px] h-[18px]" />, type: 'audio', description: 'Upload or embed an audio file.' },
  { id: 'file', label: 'File', icon: <Paperclip className="w-[18px] h-[18px]" />, type: 'file', description: 'Upload or embed a file.' },
  { id: 'web_bookmark', label: 'Web bookmark', icon: <Bookmark className="w-[18px] h-[18px]" />, type: 'web_bookmark', description: 'Add a web bookmark.' },
];

// Combined for backward compatibility
const commandOptions: CommandOption[] = [...basicBlocks, ...mediaBlocks];

const getNumberedListIndex = (allBlocks: EditorBlock[], currentIndex: number) => {
  let count = 0;
  for (let i = 0; i <= currentIndex; i += 1) {
    if (allBlocks[i].type === 'numbered_list') {
      count += 1;
    }
  }
  return count || 1;
};

// Video block component to handle preview properly
const VideoBlock = React.memo(({ 
  blockId, 
  html, 
  onRef, 
  onClick, 
  className 
}: { 
  blockId: string; 
  html: string; 
  onRef: (node: HTMLDivElement | null) => void;
  onClick: () => void;
  className: string;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    // Extract video URL from HTML
    if (html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const video = tempDiv.querySelector('video');
      const src = video?.getAttribute('src') || '';
      setVideoSrc(src);
    }
  }, [html]);

  // Lazy load video - only load when in viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !videoSrc) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' } // Start loading 100px before entering viewport
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc || !isInView) return;

    const handleLoadedMetadata = () => {
      // Metadata loaded - try to show first frame
      setIsLoading(false);
      try {
        // Seek to a small time to load first frame
        video.currentTime = 0.1;
        setTimeout(() => {
          if (video.readyState >= 2) {
            video.currentTime = 0;
            setShowPreview(true);
          }
        }, 100);
      } catch (e) {
        console.warn('Error setting video preview:', e);
        setShowPreview(true);
      }
    };

    const handleCanPlay = () => {
      // Video can play - show preview
      setIsLoading(false);
      if (!showPreview) {
        try {
          if (video.currentTime === 0) {
            video.currentTime = 0.1;
            setTimeout(() => {
              video.currentTime = 0;
              setShowPreview(true);
            }, 50);
          } else {
            setShowPreview(true);
          }
        } catch (e) {
          setShowPreview(true);
        }
      }
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handlePlaying = () => {
      setIsLoading(false);
      setShowPreview(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    // If already loaded, trigger immediately
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [videoSrc, showPreview, isInView]);

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    if (containerRef.current !== node) {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
    onRef(node);
  }, [onRef]);

  if (!videoSrc) {
    return (
      <div
        ref={onRef}
        className={className}
        data-block-id={blockId}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: html || '' }}
      />
    );
  }

  return (
    <div
      ref={setRefs}
      className={`${className} relative`}
      data-block-id={blockId}
      onClick={onClick}
    >
      {(!isInView || isLoading) && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10 min-h-[200px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
            <p className="text-sm text-gray-500">
              {!isInView ? 'Scroll to load video...' : 'Loading video...'}
            </p>
          </div>
        </div>
      )}
      {isInView && (
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          preload="metadata"
          playsInline
          muted={false}
          style={{ 
            maxWidth: '100%', 
            width: '100%', 
            height: 'auto', 
            display: 'block',
            opacity: showPreview ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out'
          }}
        />
      )}
    </div>
  );
});

VideoBlock.displayName = 'VideoBlock';

export default function NotionEditor({ blocks, setBlocks, draftId }: NotionEditorProps) {
  const blockRefs = useRef(new Map<string, HTMLDivElement | null>());
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandMenuPosition, setCommandMenuPosition] = useState({ top: 0, left: 0 });
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const commandMenuRef = useRef<HTMLDivElement | null>(null);
  const [showLanguageSelector, setShowLanguageSelector] = useState<string | null>(null);
  const languageSelectorRef = useRef<HTMLDivElement | null>(null);
  const [highlightedCode, setHighlightedCode] = useState<Record<string, string>>({});
  const [resizingColumn, setResizingColumn] = useState<{ blockId: string; columnIndex: number } | null>(null);
  const resizingRef = useRef<{ blockId: string; columnIndex: number; startX: number; startWidth: number } | null>(null);

  const editorScrollRef = useRef<HTMLDivElement>(null);
  const [scrollReady, setScrollReady] = useState(false);

  useLayoutEffect(() => {
    if (editorScrollRef.current) {
      setScrollReady(true);
    }
  }, []);

  const { outlineItems, activeOutlineId, hoveredOutlineId, setHoveredOutlineId, handleOutlineClick } =
    useOutline(blocks, editorScrollRef, scrollReady);

  const activeBlock = useMemo(
    () => blocks.find((block) => block.id === activeBlockId) || null,
    [activeBlockId, blocks]
  );

  // Handle cross-block text selection
  useEffect(() => {
    let isSelecting = false;
    let startBlockId: string | null = null;
    
    // Capture blocks in closure
    const currentBlocks = blocks;
    
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const blockElement = target.closest('[data-block-id]') as HTMLElement;
      if (blockElement) {
        isSelecting = true;
        startBlockId = blockElement.getAttribute('data-block-id');
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelecting || e.buttons !== 1) return;
      
      // Use requestAnimationFrame to ensure selection is updated
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          return;
        }
        
        try {
          const range = selection.getRangeAt(0);
          if (range.collapsed) {
            return;
          }
          
          const container = document.querySelector('[data-notion-editor-container]') as HTMLElement;
          if (!container) {
            return;
          }

          const allBlocks = Array.from(container.querySelectorAll('[data-block-id]')) as HTMLElement[];
          
          // Create a map of block IDs to their indices in the React state array for faster lookup
          const blockIdToIndex = new Map<string, number>();
          currentBlocks.forEach((block, index) => {
            blockIdToIndex.set(block.id, index);
          });
          
          const findBlock = (node: Node): HTMLElement | null => {
            let current: Node | null = node;
            let depth = 0;
            while (current && depth < 20) { // Limit depth to avoid infinite loops
              if (current.nodeType === Node.ELEMENT_NODE) {
                const element = current as HTMLElement;
                if (element.hasAttribute('data-block-id')) {
                  return element;
                }
              }
              current = current.parentNode;
              depth++;
            }
            return null;
          };
          
          const startBlock = findBlock(range.startContainer);
          const endBlock = findBlock(range.endContainer);
          
          // Check if selection spans multiple blocks by examining all blocks between start and end
          if (startBlock && endBlock) {
            const startBlockId = startBlock.getAttribute('data-block-id');
            const endBlockId = endBlock.getAttribute('data-block-id');
            
            if (startBlockId && endBlockId) {
              // Find indices in the React state blocks array using the map
              const startIndexInBlocks = blockIdToIndex.get(startBlockId);
              const endIndexInBlocks = blockIdToIndex.get(endBlockId);
              
              // Always check the element under the mouse cursor to extend selection dynamically
              const point = new DOMPoint(e.clientX, e.clientY);
              const elementUnderMouse = document.elementFromPoint(point.x, point.y);
              const blockUnderMouse = elementUnderMouse ? findBlock(elementUnderMouse) : null;
              
              // Determine the effective end block (use mouse position if it's different and valid)
              let effectiveEndBlock = endBlock;
              let effectiveEndBlockId = endBlockId;
              
              if (blockUnderMouse && blockUnderMouse !== startBlock) {
                const mouseBlockId = blockUnderMouse.getAttribute('data-block-id');
                if (mouseBlockId) {
                  // Use mouse position as the end if it's different from the range's end
                  // This helps extend selection when dragging across blocks
                  effectiveEndBlock = blockUnderMouse;
                  effectiveEndBlockId = mouseBlockId;
                }
              }
              
              // Find indices for start and effective end
              const effectiveStartIndex = blockIdToIndex.get(startBlockId);
              const effectiveEndIndex = blockIdToIndex.get(effectiveEndBlockId);
              
              // Handle cross-block selection if we have valid indices
              if (effectiveStartIndex !== undefined && effectiveEndIndex !== undefined) {
                const firstIndex = Math.min(effectiveStartIndex, effectiveEndIndex);
                const lastIndex = Math.max(effectiveStartIndex, effectiveEndIndex);
                
                // Update selectedBlockIds with all blocks in the range
                const selectedIds = currentBlocks.slice(firstIndex, lastIndex + 1).map((b: EditorBlock) => b.id);
                setSelectedBlockIds(selectedIds);
                setLastSelectedIndex(lastIndex);
                
                // Find DOM elements for first and last blocks
                const firstBlockEl = allBlocks.find(el => el.getAttribute('data-block-id') === currentBlocks[firstIndex].id);
                const lastBlockEl = allBlocks.find(el => el.getAttribute('data-block-id') === currentBlocks[lastIndex].id);
                
                if (firstBlockEl && lastBlockEl) {
                  const getFirstTextNode = (element: HTMLElement): Node | null => {
                    const walker = document.createTreeWalker(
                      element,
                      NodeFilter.SHOW_TEXT,
                      null
                    );
                    return walker.nextNode();
                  };
                  
                  const getLastTextNode = (element: HTMLElement): Node | null => {
                    let lastText: Node | null = null;
                    const walker = document.createTreeWalker(
                      element,
                      NodeFilter.SHOW_TEXT,
                      null
                    );
                    let node;
                    while ((node = walker.nextNode())) {
                      lastText = node;
                    }
                    return lastText;
                  };
                  
                  const newRange = document.createRange();
                  
                  // Set start to beginning of first block
                  const firstTextNode = getFirstTextNode(firstBlockEl);
                  if (firstTextNode) {
                    newRange.setStart(firstTextNode, 0);
                  } else {
                    newRange.setStart(firstBlockEl, 0);
                  }
                  
                  // Set end to end of last block
                  const lastTextNode = getLastTextNode(lastBlockEl);
                  if (lastTextNode) {
                    newRange.setEnd(lastTextNode, lastTextNode.textContent?.length || 0);
                  } else {
                    newRange.setEnd(lastBlockEl, lastBlockEl.childNodes.length);
                  }
                  
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                }
              }
            }
          }
        } catch (err: unknown) {
          console.error('Error in cross-block selection:', err);
        }
      });
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting) return;
      
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        isSelecting = false;
        startBlockId = null;
        return;
      }
      
      try {
        const range = selection.getRangeAt(0);
        if (range.collapsed) {
          isSelecting = false;
          startBlockId = null;
          return;
        }
        
        const container = document.querySelector('[data-notion-editor-container]') as HTMLElement;
        if (!container) {
          isSelecting = false;
          startBlockId = null;
          return;
        }

        const allBlocks = Array.from(container.querySelectorAll('[data-block-id]')) as HTMLElement[];
        
        const findBlock = (node: Node): HTMLElement | null => {
          let current: Node | null = node;
          while (current) {
            if (current.nodeType === Node.ELEMENT_NODE) {
              const element = current as HTMLElement;
              if (element.hasAttribute('data-block-id')) {
                return element;
              }
            }
            current = current.parentNode;
          }
          return null;
        };
        
        const startBlock = findBlock(range.startContainer);
        const endBlock = findBlock(range.endContainer);
        
        if (startBlock && endBlock && startBlock !== endBlock) {
          const startBlockId = startBlock.getAttribute('data-block-id');
          const endBlockId = endBlock.getAttribute('data-block-id');
          
          if (startBlockId && endBlockId) {
            // Create a map of block IDs to their indices in the React state array for faster lookup
            const blockIdToIndex = new Map<string, number>();
            currentBlocks.forEach((block, index) => {
              blockIdToIndex.set(block.id, index);
            });
            
            // Find indices in the React state blocks array using the map
            const startIndexInBlocks = blockIdToIndex.get(startBlockId);
            const endIndexInBlocks = blockIdToIndex.get(endBlockId);
            
            if (startIndexInBlocks !== undefined && endIndexInBlocks !== undefined) {
              const firstIndex = Math.min(startIndexInBlocks, endIndexInBlocks);
              const lastIndex = Math.max(startIndexInBlocks, endIndexInBlocks);
              
              // Update selectedBlockIds with all blocks in the range
              const selectedIds = currentBlocks.slice(firstIndex, lastIndex + 1).map((b: EditorBlock) => b.id);
              setSelectedBlockIds(selectedIds);
              setLastSelectedIndex(lastIndex);
              
              // Find DOM elements for first and last blocks
              const firstBlockEl = allBlocks.find(el => el.getAttribute('data-block-id') === currentBlocks[firstIndex].id);
              const lastBlockEl = allBlocks.find(el => el.getAttribute('data-block-id') === currentBlocks[lastIndex].id);
              
              if (firstBlockEl && lastBlockEl) {
                const getFirstTextNode = (element: HTMLElement): Node | null => {
                  const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    null
                  );
                  return walker.nextNode();
                };
                
                const getLastTextNode = (element: HTMLElement): Node | null => {
                  let lastText: Node | null = null;
                  const walker = document.createTreeWalker(
                    element,
                    NodeFilter.SHOW_TEXT,
                    null
                  );
                  let node;
                  while ((node = walker.nextNode())) {
                    lastText = node;
                  }
                  return lastText;
                };
                
                const newRange = document.createRange();
                
                // Set start to beginning of first block
                const firstTextNode = getFirstTextNode(firstBlockEl);
                if (firstTextNode) {
                  newRange.setStart(firstTextNode, 0);
                } else {
                  newRange.setStart(firstBlockEl, 0);
                }
                
                // Set end to end of last block
                const lastTextNode = getLastTextNode(lastBlockEl);
                if (lastTextNode) {
                  newRange.setEnd(lastTextNode, lastTextNode.textContent?.length || 0);
                } else {
                  newRange.setEnd(lastBlockEl, lastBlockEl.childNodes.length);
                }
                
                selection.removeAllRanges();
                selection.addRange(newRange);
              }
            }
          }
        }
      } catch (err: unknown) {
        console.error('Error finalizing cross-block selection:', err);
      }
      
      isSelecting = false;
      startBlockId = null;
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [blocks]);

  // Load highlight.js on mount
  useEffect(() => {
    loadHighlightJs();
  }, []);

  // Auto-detect language for code blocks when content changes
  const detectLanguageForCodeBlock = useCallback(async (blockId: string, code: string) => {
    if (!code || !code.trim()) return;
    
    await loadHighlightJs();
    if (!hljsModule) return;
    
    try {
      const detectedLanguage = detectLanguage(code);
      
      // Update language if not already set or if it's plain
      setBlocks((prev) =>
        prev.map((block) => {
          if (block.id === blockId && block.type === 'code') {
            const currentLang = block.language || 'plain';
            // Only update if current language is plain or not set
            if (currentLang === 'plain' || !currentLang) {
              return { ...block, language: detectedLanguage };
            }
          }
          return block;
        })
      );
    } catch (error) {
      console.warn('Language detection failed:', error);
    }
  }, [setBlocks]);

  // Update highlighted code when blocks change (always, including focused blocks)
  useEffect(() => {
    const updateHighlights = async () => {
      await loadHighlightJs();
      if (!hljsModule) return;
      
      const newHighlights: Record<string, string> = {};
      blocks.forEach((block) => {
        if (block.type === 'code' && block.html && block.html.trim()) {
          newHighlights[block.id] = highlightCode(block.html, block.language);
        }
      });
      setHighlightedCode(newHighlights);
    };
    updateHighlights();
  }, [blocks]);

  useEffect(() => {
    blocks.forEach((block) => {
      if (!isTextBlock(block.type)) return;
      const element = blockRefs.current.get(block.id);
      if (!element) return;
      
      // For code blocks, always show highlighted version
      if (block.type === 'code') {
        // Ensure block.html is always plain text (no HTML tags)
        const textContent = block.html || '';
        // Clean any HTML tags that might have been accidentally added
        const cleanText = textContent.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        
        // Update block.html if it contains HTML tags
        if (cleanText !== textContent && textContent.includes('<')) {
          updateBlockHtml(block.id, cleanText);
          return; // Skip this update cycle, will update on next render
        }
        
        const displayPre = element.querySelector('pre:not(textarea)');
        const textarea = element.querySelector('textarea') as HTMLTextAreaElement;
        
        // Update highlighted display using textContent (not innerHTML for raw text)
        if (displayPre) {
          const codeEl = displayPre.querySelector('code.hljs');
          if (codeEl) {
            // Set textContent first (raw code, no HTML parsing)
            if (codeEl.textContent !== cleanText) {
              codeEl.textContent = cleanText;
            }
            
            // Then apply highlighting if we have highlighted version
            if (cleanText.trim()) {
              const highlighted = highlightedCode[block.id];
              if (highlighted) {
                codeEl.innerHTML = highlighted;
              } else if (hljsModule) {
                // Highlight on the fly if not already highlighted
                try {
                  const result = block.language && block.language !== 'plain'
                    ? hljsModule.highlight(cleanText, { language: block.language })
                    : hljsModule.highlightAuto(cleanText);
                  codeEl.innerHTML = result.value;
                  setHighlightedCode((prev) => ({
                    ...prev,
                    [block.id]: result.value,
                  }));
                } catch (error) {
                  console.warn('Code highlighting failed:', error);
                  codeEl.textContent = cleanText;
                }
              }
            } else {
              codeEl.textContent = '';
            }
          }
        }
        
        // Sync textarea value (only if not currently focused to avoid cursor issues)
        if (textarea && activeBlockId !== block.id) {
          if (textarea.value !== cleanText) {
            textarea.value = cleanText;
            // Auto-resize
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            textarea.style.height = `${Math.max(scrollHeight, 120)}px`;
          }
        }
        
        // Sync scroll when focused
        if (textarea && displayPre && activeBlockId === block.id) {
          displayPre.scrollTop = textarea.scrollTop;
          displayPre.scrollLeft = textarea.scrollLeft;
          // Update display pre height to match textarea
          const preElement = displayPre as HTMLElement;
          preElement.style.height = textarea.style.height;
        }
        
        return;
      }
      
      // For tables, don't update innerHTML during editing to prevent focus loss
      // Tables are contentEditable and should be managed by the browser
      // Only sync on blur, but update when not editing (e.g., after adding rows/columns)
      if (block.type === 'table') {
        const hasTable = element.querySelector('table');
        const tableHtml = block.html || TABLE_TEMPLATE;
        
        // Only update if:
        // 1. Table doesn't exist (initial render)
        // 2. Not currently editing this block AND content changed (e.g., added row/column)
        if (!hasTable) {
          // Initial render - set the table
          const sanitized = sanitizeHtmlContent(tableHtml);
          element.innerHTML = sanitized;
        } else if (activeBlockId !== block.id) {
          // Not currently editing, safe to update if content changed
          // This handles cases like adding rows/columns
          const sanitized = sanitizeHtmlContent(tableHtml);
          const currentInnerHtml = element.innerHTML.trim();
          const sanitizedTrimmed = sanitized.trim();
          
          // Only update if content actually changed
          if (currentInnerHtml !== sanitizedTrimmed) {
            // Save current selection if any (though unlikely for non-active block)
            element.innerHTML = sanitized;
            // Resize handlers will be re-setup by useEffect (depends on blocks)
          }
        } else {
          // Currently editing - check if we need to update (e.g., after adding row/column)
          // Compare block.html with current DOM to see if structure changed
          const sanitized = sanitizeHtmlContent(tableHtml);
          const currentTable = element.querySelector('table');
          if (currentTable) {
            // Check if row/column count matches
            const currentRows = currentTable.querySelectorAll('tr');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = sanitized;
            const expectedTable = tempDiv.querySelector('table');
            if (expectedTable) {
              const expectedRows = expectedTable.querySelectorAll('tr');
              // If row count changed, update DOM
              if (currentRows.length !== expectedRows.length) {
                // Row count changed - update DOM
                element.innerHTML = sanitized;
                return;
              }
              // Check column count
              if (currentRows.length > 0 && expectedRows.length > 0) {
                const currentCols = currentRows[0].querySelectorAll('td, th').length;
                const expectedCols = expectedRows[0].querySelectorAll('td, th').length;
                if (currentCols !== expectedCols) {
                  // Column count changed - update DOM
                  element.innerHTML = sanitized;
                  return;
                }
              }
            }
          }
        }
        // If currently editing, don't update to prevent focus loss
        return;
      }
      
      const sanitized = sanitizeHtmlContent(block.html);
      const normalized =
        block.type === 'todo_list'
          ? ensureTodoMarker(sanitized, isTodoCheckedInHtml(sanitized))
          : sanitized;
      if (element.innerHTML !== normalized) {
        element.innerHTML = normalized;
      }
    });
  }, [blocks, sanitizeHtmlContent, activeBlockId, highlightedCode]);

  const registerBlockRef = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      blockRefs.current.set(id, node);
    } else {
      blockRefs.current.delete(id);
    }
  }, []);

  const focusBlock = useCallback((id: string, moveCaretToEnd = true) => {
    requestAnimationFrame(() => {
      const element = blockRefs.current.get(id);
      if (element) {
        element.focus();
        if (moveCaretToEnd) {
          placeCaretAtEnd(element);
        }
        setActiveBlockId(id);
      }
    });
  }, []);

  const updateBlockHtml = useCallback((id: string, html: string) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        const sanitizedHtml = sanitizeHtmlContent(html);
        const nextHtml =
          block.type === 'todo_list'
            ? ensureTodoMarker(sanitizedHtml)
            : removeTodoMarker(sanitizedHtml);
        return { ...block, html: nextHtml };
      })
    );
  }, [sanitizeHtmlContent, setBlocks]);

  const updateBlockType = useCallback((id: string, type: NotionBlockType | string) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        let nextHtml = block.html;
        if (type === 'todo_list') {
          nextHtml = ensureTodoMarker(block.html);
        } else if (block.type === 'todo_list') {
          nextHtml = removeTodoMarker(block.html);
        }
        if (type === 'table') {
          nextHtml = TABLE_TEMPLATE;
        }
        if (type === 'divider') {
          nextHtml = '<hr />';
        }
        return { ...block, type, html: nextHtml };
      })
    );
  }, [setBlocks]);

  const updateBlockLanguage = useCallback((id: string, language: string) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        return { ...block, language };
      })
    );
    setShowLanguageSelector(null);
  }, [setBlocks]);

  const insertBlockAfter = useCallback((afterId: string, type: NotionBlockType | string = 'rich_text') => {
    const newBlock = createEmptyBlock(type);
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === afterId);
      if (index === -1) {
        return [...prev, newBlock];
      }
      const nextBlocks = [...prev.slice(0, index + 1), newBlock, ...prev.slice(index + 1)];
      return nextBlocks;
    });
    focusBlock(newBlock.id);
  }, [focusBlock, setBlocks]);

  const insertBlockBefore = useCallback((beforeId: string, type: NotionBlockType | string = 'rich_text') => {
    const newBlock = createEmptyBlock(type);
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === beforeId);
      if (index === -1) {
        return [newBlock, ...prev];
      }
      const nextBlocks = [...prev.slice(0, index), newBlock, ...prev.slice(index)];
      return nextBlocks;
    });
    focusBlock(newBlock.id);
  }, [focusBlock, setBlocks]);

  const addTableRow = useCallback((id: string) => {
    console.log('addTableRow called for block:', id);
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        const newHtml = addRowToTableHtml(block.html);
        console.log('addTableRow: new HTML length:', newHtml.length);
        return {
          ...block,
          html: newHtml,
        };
      })
    );
  }, [setBlocks]);

  const addTableColumn = useCallback((id: string) => {
    console.log('addTableColumn called for block:', id);
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        const newHtml = addColumnToTableHtml(block.html);
        console.log('addTableColumn: new HTML length:', newHtml.length);
        return {
          ...block,
          html: newHtml,
        };
      })
    );
    // After state update, directly update DOM to set table width to auto
    setTimeout(() => {
      const element = blockRefs.current.get(id);
      if (element) {
        const table = element.querySelector('table');
        if (table) {
          (table as HTMLElement).style.width = 'auto';
          (table as HTMLElement).style.setProperty('width', 'auto', 'important');
        }
      }
    }, 0);
  }, [setBlocks]);

  const resizeTableColumn = useCallback((id: string, columnIndex: number, newWidth: number) => {
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id || block.type !== 'table') return block;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = block.html;
        const table = tempDiv.querySelector('table');
        if (!table) return block;
        
        // Ensure table-layout: fixed and allow table to grow beyond 100%
        (table as HTMLElement).style.tableLayout = 'fixed';
        (table as HTMLElement).style.width = 'auto';
        (table as HTMLElement).style.setProperty('width', 'auto', 'important');
        
        // Get all rows
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) return block;
        
        // Resize the column in all rows
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td, th');
          if (cells[columnIndex]) {
            const cell = cells[columnIndex] as HTMLElement;
            cell.style.width = `${newWidth}px`;
            cell.style.minWidth = `${newWidth}px`;
          }
        });
        
        return {
          ...block,
          html: table.outerHTML,
        };
      })
    );
  }, [setBlocks]);

  // Setup table column resize handlers
  useEffect(() => {
    // Don't re-setup handles if we're currently resizing
    if (resizingRef.current) return;
    
    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      blocks.forEach((block) => {
        if (block.type !== 'table') return;
        const element = blockRefs.current.get(block.id);
        if (!element) return;
        
        const table = element.querySelector('table');
        if (!table) return;
        
        // Get first row to determine column count
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) return;
        const firstRow = rows[0];
        const cells = firstRow.querySelectorAll('td, th');
        const columnCount = cells.length;
        
        // If table has more than 3 columns (initial), set width to auto to allow overflow
        if (columnCount > 3) {
          (table as HTMLElement).style.width = 'auto';
          (table as HTMLElement).style.setProperty('width', 'auto', 'important');
        }
        
        // Remove existing resize handlers
        const existingHandles = table.querySelectorAll('.column-resize-handle');
        existingHandles.forEach(handle => handle.remove());
        
        // Add resize handles to each column (except last) in every row
        for (let colIndex = 0; colIndex < columnCount - 1; colIndex++) {
          rows.forEach((row) => {
            const rowCells = row.querySelectorAll('td, th');
            if (rowCells[colIndex]) {
              const cellElement = rowCells[colIndex] as HTMLElement;
              
              // Skip if handle already exists
              if (cellElement.querySelector('.column-resize-handle')) return;
              
              // Create resize handle for this column
              const handle = document.createElement('div');
              handle.className = 'column-resize-handle';
              handle.setAttribute('data-column-index', colIndex.toString());
              handle.setAttribute('data-block-id', block.id);
              handle.style.cssText = `
                position: absolute;
                top: 0;
                bottom: 0;
                width: 6px;
                cursor: col-resize;
                z-index: 30;
                background: transparent;
                right: -3px;
                transition: background 0.15s ease;
                pointer-events: auto;
              `;
              
              if (!cellElement.style.position || cellElement.style.position === 'static') {
                cellElement.style.position = 'relative';
              }
              cellElement.appendChild(handle);
              
              // Mouse down handler
              const handleMouseDown = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // Use first row cell for width calculation
                const firstRowCell = firstRow.querySelectorAll('td, th')[colIndex] as HTMLElement;
                const rect = firstRowCell ? firstRowCell.getBoundingClientRect() : cellElement.getBoundingClientRect();
                const startX = e.clientX;
                // Get current width from style or computed style
                let startWidth = rect.width;
                if (firstRowCell) {
                  const styleWidth = firstRowCell.style.width;
                  if (styleWidth) {
                    startWidth = parseFloat(styleWidth) || rect.width;
                  }
                }
                
                resizingRef.current = {
                  blockId: block.id,
                  columnIndex: colIndex,
                  startX,
                  startWidth,
                };
                setResizingColumn({ blockId: block.id, columnIndex: colIndex });
                
                // Show all handles for this column
                rows.forEach((r) => {
                  const rCells = r.querySelectorAll('td, th');
                  if (rCells[colIndex]) {
                    const h = rCells[colIndex].querySelector('.column-resize-handle') as HTMLElement;
                    if (h) {
                      h.style.background = '#3CCED7';
                    }
                  }
                });
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  if (!resizingRef.current) return;
                  const diff = moveEvent.clientX - startX;
                  const newWidth = Math.max(50, startWidth + diff);
                  
                  // Update DOM directly during dragging for immediate feedback
                  // Don't update state to avoid triggering useEffect and re-rendering
                  rows.forEach((r) => {
                    const rCells = r.querySelectorAll('td, th');
                    if (rCells[colIndex]) {
                      const cell = rCells[colIndex] as HTMLElement;
                      cell.style.width = `${newWidth}px`;
                      cell.style.minWidth = `${newWidth}px`;
                    }
                  });
                  
                  // Store the new width in resizingRef for final update
                  resizingRef.current.startWidth = newWidth;
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                  
                  // Update state with final width only after dragging is complete
                  if (resizingRef.current) {
                    const finalWidth = resizingRef.current.startWidth;
                    resizeTableColumn(block.id, colIndex, finalWidth);
                  }
                  
                  resizingRef.current = null;
                  setResizingColumn(null);
                  
                  // Hide all handles for this column
                  rows.forEach((r) => {
                    const rCells = r.querySelectorAll('td, th');
                    if (rCells[colIndex]) {
                      const h = rCells[colIndex].querySelector('.column-resize-handle') as HTMLElement;
                      if (h) {
                        h.style.background = 'transparent';
                      }
                    }
                  });
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              };
              
              handle.addEventListener('mousedown', handleMouseDown);
              
              // Hover effect - show all handles in this column
              const showHandle = () => {
                if (!resizingColumn || resizingColumn.blockId !== block.id || resizingColumn.columnIndex !== colIndex) {
                  rows.forEach((r) => {
                    const rCells = r.querySelectorAll('td, th');
                    if (rCells[colIndex]) {
                      const h = rCells[colIndex].querySelector('.column-resize-handle') as HTMLElement;
                      if (h) {
                        h.style.background = '#3CCED7';
                        h.style.opacity = '0.6';
                      }
                    }
                  });
                }
              };
              
              const hideHandle = () => {
                if (!resizingColumn || resizingColumn.blockId !== block.id || resizingColumn.columnIndex !== colIndex) {
                  rows.forEach((r) => {
                    const rCells = r.querySelectorAll('td, th');
                    if (rCells[colIndex]) {
                      const h = rCells[colIndex].querySelector('.column-resize-handle') as HTMLElement;
                      if (h) {
                        h.style.background = 'transparent';
                        h.style.opacity = '1';
                      }
                    }
                  });
                }
              };
              
              handle.addEventListener('mouseenter', showHandle);
              handle.addEventListener('mouseleave', hideHandle);
              
              // Also show on cell hover
              cellElement.addEventListener('mouseenter', () => {
                if (!resizingColumn) {
                  rows.forEach((r) => {
                    const rCells = r.querySelectorAll('td, th');
                    if (rCells[colIndex]) {
                      const h = rCells[colIndex].querySelector('.column-resize-handle') as HTMLElement;
                      if (h) {
                        h.style.background = '#3CCED7';
                        h.style.opacity = '0.6';
                      }
                    }
                  });
                }
              });
              
              cellElement.addEventListener('mouseleave', () => {
                if (!resizingColumn || resizingColumn.blockId !== block.id || resizingColumn.columnIndex !== colIndex) {
                  rows.forEach((r) => {
                    const rCells = r.querySelectorAll('td, th');
                    if (rCells[colIndex]) {
                      const h = rCells[colIndex].querySelector('.column-resize-handle') as HTMLElement;
                      if (h) {
                        h.style.background = 'transparent';
                        h.style.opacity = '1';
                      }
                    }
                  });
                }
              });
            }
          });
        }
      });
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [blocks, resizeTableColumn, resizingColumn, activeBlockId]);

  const toggleTodoState = useCallback((id: string) => {
    let updatedHtml: string | null = null;
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        const nextChecked = !isTodoCheckedInHtml(block.html);
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[NotionEditor] toggle todo', { id, nextChecked });
        }
        updatedHtml = setTodoStateInHtml(block.html, nextChecked);
        return {
          ...block,
          html: updatedHtml,
        };
      })
    );
    if (updatedHtml !== null) {
      const element = blockRefs.current.get(id);
      if (element) {
        element.innerHTML = updatedHtml;
      }
    }
  }, [blockRefs, setBlocks]);

  const getBlockTypeById = useCallback(
    (blockId: string): NotionBlockType | string => {
      const block = blocks.find((b) => b.id === blockId);
      return block?.type || 'rich_text';
    },
    [blocks]
  );

  const insertBlockAfterSameType = useCallback(
    (blockId: string) => {
      insertBlockAfter(blockId, getBlockTypeById(blockId));
    },
    [getBlockTypeById, insertBlockAfter]
  );

  const moveBlock = useCallback((draggedId: string, targetId: string, position: 'before' | 'after') => {
    setBlocks((prev) => {
      const draggedIndex = prev.findIndex((b) => b.id === draggedId);
      const targetIndex = prev.findIndex((b) => b.id === targetId);
      
      if (draggedIndex === -1 || targetIndex === -1) {
        return prev;
      }
      
      // If dragging to the same position, do nothing
      if (draggedIndex === targetIndex) {
        return prev;
      }
      
      const draggedBlock = prev[draggedIndex];
      const blocksWithoutDragged = prev.filter((b) => b.id !== draggedId);
      
      // Calculate the new index in the array without the dragged block
      let newTargetIndex = targetIndex;
      if (targetIndex > draggedIndex) {
        // If dragging down, adjust target index
        newTargetIndex = targetIndex - 1;
      }
      
      let insertIndex: number;
      if (position === 'before') {
        insertIndex = newTargetIndex;
      } else {
        insertIndex = newTargetIndex + 1;
      }
      
      // Clamp insertIndex to valid range
      insertIndex = Math.max(0, Math.min(insertIndex, blocksWithoutDragged.length));
      
      const nextBlocks = [
        ...blocksWithoutDragged.slice(0, insertIndex),
        draggedBlock,
        ...blocksWithoutDragged.slice(insertIndex),
      ];
      
      return nextBlocks;
    });
  }, [setBlocks]);

  const splitBlockAtCursor = useCallback((id: string) => {
    const element = blockRefs.current.get(id);
    const currentBlock = blocks.find((b) => b.id === id);
    const currentType = currentBlock?.type || 'rich_text';
    if (!element) {
      insertBlockAfter(id, currentType);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      insertBlockAfter(id, currentType);
      return;
    }

    const range = selection.getRangeAt(0);
    const textContent = element.textContent || '';
    
    // Check if cursor is at the end
    const isAtEnd = 
      (range.startContainer === element && range.startOffset === element.childNodes.length) ||
      (range.startContainer.nodeType === Node.TEXT_NODE && 
       range.startOffset >= (range.startContainer.textContent?.length || 0) &&
       !range.startContainer.nextSibling);
    
    if (isAtEnd || isEmptyHtml(element.innerHTML)) {
      insertBlockAfter(id, currentType);
      return;
    }

    if (!currentBlock) {
      insertBlockAfter(id, currentType);
      return;
    }

    // Use document.execCommand to split the content
    try {
      // Save current HTML
      const currentHtml = element.innerHTML;
      
      // Create a temporary container to split HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = currentHtml;
      
      // Get text content and cursor position
      const textBefore = textContent.slice(0, range.startOffset);
      const textAfter = textContent.slice(range.startOffset);
      
      // If there's no text after cursor, just insert new block
      if (!textAfter.trim()) {
        insertBlockAfter(id, currentType);
        return;
      }

      // Update current block with text before cursor
      const updatedCurrentBlock = {
        ...currentBlock,
        html: textBefore ? `<div>${textBefore}</div>` : '',
      };

      // Create new block with text after cursor
      const newBlock = createEmptyBlock(currentBlock.type);
      newBlock.html = textAfter ? `<div>${textAfter}</div>` : '';

      // Insert new block after current one
      setBlocks((prev) => {
        const index = prev.findIndex((b) => b.id === id);
        if (index === -1) {
          return [...prev, newBlock];
        }
        const nextBlocks = [
          ...prev.slice(0, index),
          updatedCurrentBlock,
          newBlock,
          ...prev.slice(index + 1),
        ];
        return nextBlocks;
      });

      // Focus the new block
      setTimeout(() => {
        focusBlock(newBlock.id, false);
        // Place cursor at start of new block
        const newElement = blockRefs.current.get(newBlock.id);
        if (newElement) {
          const newSelection = window.getSelection();
          if (newSelection) {
            const newRange = document.createRange();
            newRange.setStart(newElement, 0);
            newRange.collapse(true);
            newSelection.removeAllRanges();
            newSelection.addRange(newRange);
          }
        }
      }, 0);
    } catch (error) {
      // Fallback to simple insert if splitting fails
      console.error('Error splitting block:', error);
      insertBlockAfter(id, currentType);
    }
  }, [blocks, focusBlock, insertBlockAfter, setBlocks]);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === id);
      if (index === -1) {
        return prev;
      }
      const nextBlocks = prev.filter((block) => block.id !== id);
      if (nextBlocks.length === 0) {
        const fresh = createEmptyBlock('rich_text');
        setTimeout(() => {
          const el = blockRefs.current.get(fresh.id);
          if (el) {
            el.focus();
            placeCaretAtEnd(el);
          }
        }, 0);
        return [fresh];
      }
      const fallbackBlock = nextBlocks[Math.max(0, index - 1)] ?? nextBlocks[0];
      if (fallbackBlock && isTextBlock(fallbackBlock.type)) {
        focusBlock(fallbackBlock.id);
      }
      return nextBlocks;
    });
  }, [focusBlock, setBlocks]);

  const syncActiveBlock = useCallback(() => {
    if (!activeBlockId) return;
    const element = blockRefs.current.get(activeBlockId);
    if (!element) return;
    
    // For code blocks, use textarea value instead of innerHTML to avoid HTML tags
    const currentBlock = blocks.find((b) => b.id === activeBlockId);
    if (currentBlock?.type === 'code') {
      const textarea = element.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        const textContent = textarea.value || '';
        updateBlockHtml(activeBlockId, textContent);
        return;
      }
    }
    
    // For other blocks, use innerHTML
    updateBlockHtml(activeBlockId, element.innerHTML);
  }, [activeBlockId, updateBlockHtml, blocks]);

  const runCommand = useCallback((command: Command) => {
    if (!activeBlockId) return;
    const element = blockRefs.current.get(activeBlockId);
    if (!element) return;
    
    // Ensure element is focused
    element.focus();
    
    // Get current selection
    const selection = window.getSelection();
    const hasSelection = selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed;
    
    try {
      switch (command) {
        case 'bold':
        case 'italic':
        case 'underline':
          // Apply formatting to selected text or prepare for next input
          document.execCommand(command, false);
          break;
        case 'link': {
          const url = window.prompt('Enter URL:');
          if (url && url.trim()) {
            // Validate URL format
            let validUrl = url.trim();
            if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://') && !validUrl.startsWith('mailto:')) {
              validUrl = `https://${validUrl}`;
            }
            
            if (hasSelection) {
              // Create link with selected text
              try {
                document.execCommand('createLink', false, validUrl);
              } catch (e) {
                // Fallback: wrap selection in link
                const range = selection!.getRangeAt(0);
                const selectedText = range.toString();
                const linkElement = document.createElement('a');
                linkElement.href = validUrl;
                linkElement.target = '_blank';
                linkElement.rel = 'noopener noreferrer';
                linkElement.textContent = selectedText;
                range.deleteContents();
                range.insertNode(linkElement);
              }
            } else {
              // If no selection, create link with URL as text
              const linkText = window.prompt('Enter link text (or press OK to use URL):', validUrl) || validUrl;
              const linkElement = document.createElement('a');
              linkElement.href = validUrl;
              linkElement.target = '_blank';
              linkElement.rel = 'noopener noreferrer';
              linkElement.textContent = linkText;
              
              // Insert at cursor position
              const range = selection!.getRangeAt(0);
              range.deleteContents();
              range.insertNode(linkElement);
              range.setStartAfter(linkElement);
              range.collapse(true);
              selection!.removeAllRanges();
              selection!.addRange(range);
            }
          }
          break;
        }
        default:
          break;
      }
      
      // Update block HTML after command
      setTimeout(() => {
        syncActiveBlock();
      }, 0);
    } catch (error) {
      console.error('Error executing command:', command, error);
    }
  }, [activeBlockId, syncActiveBlock]);

  const insertDivider = useCallback(() => {
    if (activeBlockId) {
      insertBlockAfter(activeBlockId, 'divider');
    } else if (blocks.length > 0) {
      insertBlockAfter(blocks[blocks.length - 1].id, 'divider');
    } else {
      setBlocks([createEmptyBlock('divider')]);
    }
  }, [activeBlockId, blocks, insertBlockAfter, setBlocks]);

  const toggleHeading = useCallback(() => {
    if (!activeBlockId) return;
    if (!activeBlock) return;
    const nextType = activeBlock.type === 'heading' ? 'rich_text' : 'heading';
    updateBlockType(activeBlockId, nextType);
    if (nextType === 'heading') {
      focusBlock(activeBlockId);
    }
  }, [activeBlock, activeBlockId, focusBlock, updateBlockType]);

  const handleInput = useCallback(
    (id: string, event: React.FormEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      const text = element.textContent || '';
      
      // Check if we're in command mode
      if (showCommandMenu) {
        const slashIndex = text.lastIndexOf('/');
        if (slashIndex !== -1) {
          const filter = text.slice(slashIndex + 1).toLowerCase();
          setCommandFilter(filter);
          setSelectedCommandIndex(0);
        } else {
          setShowCommandMenu(false);
          setCommandFilter('');
        }
      } else {
        // Check if "/" was just typed (fallback if handleKeyDown didn't catch it)
        const currentBlock = blocks.find((b) => b.id === id);
        if (currentBlock && text.endsWith('/') && !showCommandMenu) {
          const textBefore = text.slice(0, -1);
          // Show menu if "/" is at start, after space, or block was empty
          const shouldShowMenu = 
            textBefore.trim() === '' || 
            textBefore.endsWith(' ') || 
            textBefore.endsWith('\n') ||
            isEmptyHtml(currentBlock.html);
          
          if (shouldShowMenu) {
            // Get element position for menu placement
            const elementRect = element.getBoundingClientRect();
            let top = elementRect.top;
            let left = elementRect.left;
            
            // Try to get cursor position
            try {
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                if (rect.width > 0 || rect.height > 0) {
                  top = rect.bottom;
                  left = rect.left;
                }
              }
            } catch (e) {
              // Use element position as fallback
            }
            
            // Calculate menu position with smart positioning
            const menuHeight = 400;
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - top;
            const spaceAbove = top;
            
            // If not enough space below but enough space above, show menu above cursor
            if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
              top = Math.max(0, top - menuHeight - 8);
            } else if (spaceBelow < menuHeight) {
              // If not enough space either way, position at bottom with some margin
              top = Math.max(0, viewportHeight - menuHeight - 16);
            } else {
              // Normal case: show below cursor
              top = Math.max(0, top + 8);
            }
            
            // Ensure left position is valid
            left = Math.max(0, left);
            
            // Show command menu
            setCommandMenuPosition({
              top: top,
              left: left,
            });
            setShowCommandMenu(true);
            setCommandFilter('');
            setSelectedCommandIndex(0);
          }
        }
      }
      
      // For tables, don't update on every input to prevent re-renders and focus loss
      // Content will be synced on blur
      const currentBlock = blocks.find((b) => b.id === id);
      if (currentBlock?.type === 'table') {
        // Just handle command menu logic, but don't update block HTML
        return;
      }
      
      updateBlockHtml(id, element.innerHTML);
    },
    [updateBlockHtml, showCommandMenu, blocks]
  );

  const filteredBasicBlocks = useMemo(() => {
    if (!commandFilter) return basicBlocks;
    const filter = commandFilter.toLowerCase();
    return basicBlocks.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(filter) ||
        cmd.description?.toLowerCase().includes(filter)
    );
  }, [commandFilter]);

  const filteredMediaBlocks = useMemo(() => {
    if (!commandFilter) return mediaBlocks;
    const filter = commandFilter.toLowerCase();
    return mediaBlocks.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(filter) ||
        cmd.description?.toLowerCase().includes(filter)
    );
  }, [commandFilter]);

  // Combined for backward compatibility with navigation
  const filteredCommands = useMemo(() => {
    return [...filteredBasicBlocks, ...filteredMediaBlocks];
  }, [filteredBasicBlocks, filteredMediaBlocks]);

  const handleFileUpload = useCallback(
    async (file: File, mediaType: string) => {
      if (!activeBlockId) return;
      
      try {
        const response = await NotionDraftAPI.uploadMedia(file, mediaType, draftId);
        console.log('Upload response:', response);
        const blockData = response.block_data;
        console.log('Block data:', blockData);
        
        if (blockData && blockData.content) {
          // Create HTML for the media block
          let html = '';
          if (blockData.type === 'image' && blockData.content?.file_url) {
            html = `<img src="${blockData.content.file_url}" alt="${blockData.content.filename || 'Image'}" style="max-width: 100%; height: auto;" />`;
          } else if (blockData.type === 'video' && blockData.content?.file_url) {
            html = `<video src="${blockData.content.file_url}" controls preload="auto" playsinline muted style="max-width: 100%; width: 100%; height: auto; display: block;" onloadeddata="this.currentTime=0.01; setTimeout(() => { this.currentTime=0; this.muted=false; }, 100);"></video>`;
          } else if (blockData.type === 'audio' && blockData.content?.file_url) {
            html = `<audio src="${blockData.content.file_url}" controls style="width: 100%;"></audio>`;
          } else if (blockData.type === 'file' && blockData.content?.file_url) {
            html = `<a href="${blockData.content.file_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 p-3 border border-gray-200 rounded-md hover:bg-gray-50">
              <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>${blockData.content.filename || 'File'}</span>
            </a>`;
          }
          
          // Update the current block with the media content, keeping the same ID
          setBlocks((prev) =>
            prev.map((block) =>
              block.id === activeBlockId 
                ? { ...block, type: blockData.type, html }
                : block
            )
          );
          
          // Update the DOM element if it exists
          const element = blockRefs.current.get(activeBlockId);
          if (element) {
            element.innerHTML = html;
          }
        }
        
        setShowCommandMenu(false);
        setCommandFilter('');
        setSelectedCommandIndex(0);
        toast.success(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded successfully`);
      } catch (error: any) {
        console.error('Failed to upload media:', error);
        toast.error(error?.response?.data?.error || 'Failed to upload file');
      }
    },
    [activeBlockId, draftId, setBlocks]
  );

  const handleWebBookmark = useCallback(
    async () => {
      if (!activeBlockId) return;
      
      const url = window.prompt('Enter URL:');
      if (!url || !url.trim()) {
        setShowCommandMenu(false);
        setCommandFilter('');
        setSelectedCommandIndex(0);
        return;
      }
      
      try {
        const response = await NotionDraftAPI.createWebBookmark(url.trim(), undefined, undefined, undefined, draftId);
        const blockData = response.block_data;
        
        if (blockData) {
          // Update the current block with the bookmark content
          const newBlock = createEmptyBlock(blockData.type, blockData.content);
          setBlocks((prev) =>
            prev.map((block) =>
              block.id === activeBlockId ? newBlock : block
            )
          );
          
          // Remove the "/" and filter text from the element
          const element = blockRefs.current.get(activeBlockId);
          if (element) {
            element.innerHTML = newBlock.html;
          }
        }
        
        setShowCommandMenu(false);
        setCommandFilter('');
        setSelectedCommandIndex(0);
        toast.success('Web bookmark created successfully');
      } catch (error: any) {
        console.error('Failed to create web bookmark:', error);
        toast.error(error?.response?.data?.error || 'Failed to create web bookmark');
      }
    },
    [activeBlockId, draftId, setBlocks]
  );

  const handleCommandSelect = useCallback(
    (option: CommandOption) => {
      if (!activeBlockId) return;
      const element = blockRefs.current.get(activeBlockId);
      if (!element) return;

      // Handle media blocks that require file upload or URL input
      if (option.type === 'image' || option.type === 'video' || option.type === 'audio' || option.type === 'file') {
        // Remove the "/" and filter text from the element
        const text = element.textContent || '';
        const slashIndex = text.lastIndexOf('/');
        if (slashIndex !== -1) {
          const beforeSlash = text.slice(0, slashIndex);
          element.textContent = beforeSlash;
          updateBlockHtml(activeBlockId, element.innerHTML);
        }
        
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 
          option.type === 'image' ? 'image/*' :
          option.type === 'video' ? 'video/*' :
          option.type === 'audio' ? 'audio/*' :
          '*/*';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            handleFileUpload(file, option.type);
          }
        };
        input.click();
        return;
      }
      
      if (option.type === 'web_bookmark') {
        // Remove the "/" and filter text from the element
        const text = element.textContent || '';
        const slashIndex = text.lastIndexOf('/');
        if (slashIndex !== -1) {
          const beforeSlash = text.slice(0, slashIndex);
          element.textContent = beforeSlash;
          updateBlockHtml(activeBlockId, element.innerHTML);
        }
        
        handleWebBookmark();
        return;
      }

      // Remove the "/" and filter text from the element
      const text = element.textContent || '';
      const slashIndex = text.lastIndexOf('/');
      if (slashIndex !== -1) {
        const beforeSlash = text.slice(0, slashIndex);
        element.textContent = beforeSlash;
        
        // Update the HTML state
        updateBlockHtml(activeBlockId, element.innerHTML);
      }

      // Update block type based on option
      // Use option.type directly to support heading_1, heading_2, heading_3
      updateBlockType(activeBlockId, option.type);

      setShowCommandMenu(false);
      setCommandFilter('');
      setSelectedCommandIndex(0);
      
      // Focus and place cursor at end
      setTimeout(() => {
        focusBlock(activeBlockId);
      }, 0);
    },
    [activeBlockId, focusBlock, updateBlockType, updateBlockHtml, handleFileUpload, handleWebBookmark]
  );

  const handleKeyDown = useCallback(
    (id: string, event: React.KeyboardEvent<HTMLDivElement>) => {
      const currentBlock = blocks.find((b) => b.id === id);

      // Handle command menu navigation
      if (showCommandMenu) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedCommandIndex((prev) =>
            Math.min(prev + 1, filteredCommands.length - 1)
          );
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedCommandIndex((prev) => Math.max(prev - 1, 0));
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (filteredCommands[selectedCommandIndex]) {
            handleCommandSelect(filteredCommands[selectedCommandIndex]);
          }
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setShowCommandMenu(false);
          setCommandFilter('');
          setSelectedCommandIndex(0);
          return;
        }
      }

      // Handle keyboard shortcuts for formatting
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'b' || event.key === 'B') {
          event.preventDefault();
          runCommand('bold');
          return;
        }
        if (event.key === 'i' || event.key === 'I') {
          event.preventDefault();
          runCommand('italic');
          return;
        }
        if (event.key === 'k' || event.key === 'K') {
          event.preventDefault();
          runCommand('link');
          return;
        }
      }

      // Detect "/" for command menu
      if (event.key === '/' && !showCommandMenu) {
        event.preventDefault(); // Prevent "/" from being inserted immediately
        const element = blockRefs.current.get(id);
        if (element) {
          // Get current block
          const currentBlock = blocks.find((b) => b.id === id);
          if (!currentBlock) return;
          
          // Get cursor position
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          
          const range = selection.getRangeAt(0);
          const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || '';
          
          // Show menu if "/" is at start, after space, or block is empty
          const shouldShowMenu = 
            textBefore.trim() === '' || 
            textBefore.endsWith(' ') || 
            textBefore.endsWith('\n') ||
            isEmptyHtml(currentBlock.html);
          
          if (!shouldShowMenu) return;
          
          // Get element position for menu placement
          const elementRect = element.getBoundingClientRect();
          let top = elementRect.top;
          let left = elementRect.left;
          
          // Try to get cursor position, but fallback to element position if invalid
          try {
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
              // Valid cursor position
              top = rect.bottom;
              left = rect.left;
            } else {
              // Invalid cursor position, use element position
              top = elementRect.top;
              left = elementRect.left;
            }
          } catch (e) {
            // Fallback to element position
            top = elementRect.top;
            left = elementRect.left;
          }
          
          // Insert "/" into the element
          try {
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
              const textNode = range.startContainer as Text;
              textNode.insertData(range.startOffset, '/');
              range.setStart(textNode, range.startOffset + 1);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              // For empty elements, set text content
              if (!element.textContent || element.textContent.trim() === '') {
                element.textContent = '/';
                placeCaretAtEnd(element);
              } else {
                element.textContent = (element.textContent || '') + '/';
                placeCaretAtEnd(element);
              }
            }
          } catch (e) {
            // Fallback: just set text content
            element.textContent = (element.textContent || '') + '/';
            placeCaretAtEnd(element);
          }
          
          // Update block HTML
          updateBlockHtml(id, element.innerHTML);
          
          // Calculate menu position with smart positioning
          const menuHeight = 400;
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - top;
          const spaceAbove = top;
          
          // If not enough space below but enough space above, show menu above cursor
          if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
            top = Math.max(0, top - menuHeight - 8);
          } else if (spaceBelow < menuHeight) {
            // If not enough space either way, position at bottom with some margin
            top = Math.max(0, viewportHeight - menuHeight - 16);
          } else {
            // Normal case: show below cursor
            top = Math.max(0, top + 8);
          }
          
          // Ensure left position is valid
          left = Math.max(0, left);
          
          // Show command menu
          setCommandMenuPosition({
            top: top,
            left: left,
          });
          setShowCommandMenu(true);
          setCommandFilter('');
          setSelectedCommandIndex(0);
        }
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        // Don't split media blocks on Enter
        if (currentBlock?.type === 'image' || currentBlock?.type === 'video' || 
            currentBlock?.type === 'audio' || currentBlock?.type === 'file' || 
            currentBlock?.type === 'web_bookmark') {
          event.preventDefault();
          insertBlockAfter(id, 'rich_text');
          return;
        }
        if (currentBlock?.type === 'table') {
          event.preventDefault();
          document.execCommand('insertLineBreak');
          return;
        }
        if (showCommandMenu) {
          event.preventDefault();
          if (filteredCommands[selectedCommandIndex]) {
            handleCommandSelect(filteredCommands[selectedCommandIndex]);
          }
          return;
        }
        event.preventDefault();
        // Split block at cursor position or insert new block after
        splitBlockAtCursor(id);
        return;
      }
      if (event.key === 'Backspace') {
        const element = blockRefs.current.get(id);
        if (element && isEmptyHtml(element.innerHTML)) {
          event.preventDefault();
          removeBlock(id);
          return;
        }
      }
      if (event.key === 'ArrowUp') {
        if (showCommandMenu) return;
        const index = blocks.findIndex((block) => block.id === id);
        const previous = blocks[index - 1];
        if (previous && isTextBlock(previous.type)) {
          event.preventDefault();
          focusBlock(previous.id);
        }
        return;
      }
      if (event.key === 'ArrowDown') {
        if (showCommandMenu) return;
        const index = blocks.findIndex((block) => block.id === id);
        const next = blocks[index + 1];
        if (next && isTextBlock(next.type)) {
          event.preventDefault();
          focusBlock(next.id);
        } else if (!next) {
          event.preventDefault();
          insertBlockAfterSameType(id);
        }
      }
    },
    [
      blocks,
      focusBlock,
      insertBlockAfterSameType,
      removeBlock,
      showCommandMenu,
      filteredCommands,
      selectedCommandIndex,
      handleCommandSelect,
      splitBlockAtCursor,
    ]
  );

  const handlePaste = useCallback(
    (id: string, event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      
      const clipboardData = event.clipboardData;
      const element = blockRefs.current.get(id);
      if (!element) return;
      
      // Check if current block is a code block
      const currentBlock = blocks.find((b) => b.id === id);
      const isCodeBlock = currentBlock?.type === 'code';
      
      // For code blocks, always use plain text only
      const plainText = clipboardData.getData('text/plain');
      
      // Try to get HTML first (preserves formatting) - but not for code blocks
      let html = isCodeBlock ? '' : clipboardData.getData('text/html');
      
      // If no HTML, use plain text
      if (!html || html.trim() === '') {
        html = plainText.replace(/\n/g, '<br>');
      } else {
        // Clean and sanitize the HTML
        html = sanitizeHtmlContent(html);
      }
      
      // Get current selection
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        // No selection, insert at cursor or append
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false); // Collapse to end
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      
      // For code blocks, the textarea's onPaste handler will handle it
      // This function should not process code blocks to avoid conflicts
      if (isCodeBlock) {
        return; // Exit early - let textarea handle paste
      }
      
      // Check if we should split into multiple blocks
      // If HTML contains multiple block-level elements (p, div, h1-h6, etc.), split them
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Process all elements in order, maintaining the original sequence
      const blockElements: { element: Element; listType?: 'ul' | 'ol' }[] = [];
      
      // Walk through all child nodes in order
      const walkNodes = (node: Node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const tagName = element.tagName.toLowerCase();
          
          // Handle list items - extract them but mark as list items
          if (tagName === 'li') {
            const parentTag = element.parentElement?.tagName.toLowerCase();
            const listType = parentTag === 'ol' ? 'ol' : 'ul';
            blockElements.push({ element, listType });
            return; // Don't process children of li separately
          }
          
          // Handle block-level elements
          if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol'].includes(tagName)) {
            // For lists, extract list items in order
            if (tagName === 'ul' || tagName === 'ol') {
              const listItems = element.querySelectorAll(':scope > li');
              listItems.forEach((li) => {
                blockElements.push({ element: li, listType: tagName as 'ul' | 'ol' });
              });
            } else {
              blockElements.push({ element, listType: undefined });
            }
            return; // Don't process children separately
          }
        }
        
        // Process children recursively
        if (node.childNodes) {
          Array.from(node.childNodes).forEach(child => walkNodes(child));
        }
      };
      
      // Start walking from tempDiv's children
      Array.from(tempDiv.childNodes).forEach(child => walkNodes(child));
      
      // If no block elements found, check for text content
      if (blockElements.length === 0) {
        const textContent = tempDiv.textContent || '';
        if (textContent.trim()) {
          blockElements.push({ element: tempDiv });
        }
      }
      
      // If there are multiple block elements or line breaks, handle splitting
      const hasMultipleBlocks = blockElements.length > 1 || plainText.includes('\n\n') || plainText.split('\n').length > 1;
      
      if (hasMultipleBlocks && blockElements.length > 0) {
        // Split into multiple blocks, maintaining order
        const blocks: { html: string; type: string }[] = [];
        
        blockElements.forEach(({ element: blockEl, listType }) => {
          const tagName = blockEl.tagName.toLowerCase();
          let blockType = 'rich_text';
          
          // Determine block type based on tag
          if (listType || tagName === 'li') {
            if (listType === 'ol') {
              blockType = 'numbered_list';
            } else {
              blockType = 'list';
            }
            // Extract content from list item, preserving formatting
            const liContent = blockEl.innerHTML;
            blocks.push({
              html: liContent,
              type: blockType,
            });
          } else if (tagName.startsWith('h')) {
            blockType = `heading_${tagName.slice(1)}` as NotionBlockType;
            blocks.push({
              html: blockEl.innerHTML,
              type: blockType,
            });
          } else if (tagName === 'blockquote') {
            blockType = 'quote';
            blocks.push({
              html: blockEl.innerHTML,
              type: blockType,
            });
          } else if (tagName === 'pre' || (tagName === 'code' && blockEl.parentElement?.tagName.toLowerCase() === 'pre')) {
            blockType = 'code';
            // Always use textContent for code blocks to avoid HTML tags
            const codeText = blockEl.textContent || '';
            blocks.push({
              html: codeText,
              type: blockType,
            });
          } else if (tagName === 'p' || tagName === 'div' || tagName === '') {
            // Regular text block
            const content = blockEl.innerHTML || blockEl.textContent || '';
            if (content.trim() || blocks.length === 0) {
              blocks.push({
                html: content || '<br>',
                type: 'rich_text',
              });
            }
          }
        });
        
        // If no block elements found but has line breaks, split by lines
        if (blocks.length === 0 && plainText.includes('\n')) {
          const lines = plainText.split('\n');
          lines.forEach((line, index) => {
            if (line.trim() || index === 0) { // Include first line even if empty
              blocks.push({
                html: line || '<br>',
                type: 'rich_text',
              });
            }
          });
        }
        
        if (blocks.length > 0) {
          // Get current block content before and after cursor
          const beforeRange = range.cloneRange();
          beforeRange.setStart(element, 0);
          beforeRange.setEnd(range.startContainer, range.startOffset);
          const beforeContent = beforeRange.cloneContents();
          const beforeDiv = document.createElement('div');
          beforeDiv.appendChild(beforeContent);
          const beforeHtml = beforeDiv.innerHTML;
          
          const afterRange = range.cloneRange();
          afterRange.setStart(range.endContainer, range.endOffset);
          afterRange.setEnd(element, element.childNodes.length);
          const afterContent = afterRange.cloneContents();
          const afterDiv = document.createElement('div');
          afterDiv.appendChild(afterContent);
          const afterHtml = afterDiv.innerHTML;
          
          // Update current block with before content + first pasted block
          const firstBlock = blocks[0];
          
          // For code blocks, ensure we only use plain text (no HTML)
          let updatedHtml: string;
          if (firstBlock.type === 'code') {
            // For code blocks, extract plain text from beforeHtml and afterHtml
            const beforeText = beforeHtml ? (new DOMParser().parseFromString(beforeHtml, 'text/html').body.textContent || '') : '';
            const afterText = afterHtml ? (new DOMParser().parseFromString(afterHtml, 'text/html').body.textContent || '') : '';
            updatedHtml = beforeText + firstBlock.html + afterText;
          } else {
            updatedHtml = (beforeHtml ? beforeHtml : '') + firstBlock.html + (afterHtml ? afterHtml : '');
          }
          
          updateBlockHtml(id, updatedHtml || firstBlock.html);
          
          // If block type changed, update it
          if (firstBlock.type !== 'rich_text') {
            updateBlockType(id, firstBlock.type);
            // Auto-detect language for code blocks
            if (firstBlock.type === 'code' && firstBlock.html && firstBlock.html.trim()) {
              detectLanguageForCodeBlock(id, firstBlock.html);
            }
          }
          
          // Insert remaining blocks after current block
          if (blocks.length > 1) {
            // Insert blocks sequentially using setBlocks to ensure proper state updates
            setBlocks((prevBlocks) => {
              const currentBlockIndex = prevBlocks.findIndex(b => b.id === id);
              if (currentBlockIndex === -1) return prevBlocks;
              
              const newBlocks = [...prevBlocks];
              const blocksToInsert = blocks.slice(1).map((block) => ({
                id: createBlockId(),
                type: block.type as NotionBlockType,
                html: block.type === 'todo_list' ? ensureTodoMarker(block.html) : block.html,
              }));
              
              // Insert new blocks after current block
              newBlocks.splice(currentBlockIndex + 1, 0, ...blocksToInsert);
              
              // Update the blocks in the DOM after state update
              setTimeout(() => {
                blocksToInsert.forEach((newBlock) => {
                  const newElement = blockRefs.current.get(newBlock.id);
                  if (newElement) {
                    newElement.innerHTML = newBlock.html;
                    updateBlockHtml(newBlock.id, newBlock.html);
                    // Auto-detect language for code blocks
                    if (newBlock.type === 'code' && newBlock.html && newBlock.html.trim()) {
                      detectLanguageForCodeBlock(newBlock.id, newBlock.html);
                    }
                  }
                });
                
                // Focus the last inserted block
                const lastBlock = blocksToInsert[blocksToInsert.length - 1];
                if (lastBlock) {
                  const lastElement = blockRefs.current.get(lastBlock.id);
                  if (lastElement) {
                    lastElement.focus();
                    placeCaretAtEnd(lastElement);
                  }
                }
              }, 0);
              
              return newBlocks;
            });
          } else {
            // Single block, just focus it
            setTimeout(() => {
              element.focus();
              const newRange = document.createRange();
              newRange.selectNodeContents(element);
              newRange.collapse(false);
              const sel = window.getSelection();
              if (sel) {
                sel.removeAllRanges();
                sel.addRange(newRange);
              }
            }, 0);
          }
        }
      } else {
        // Single block paste (non-code blocks)
        if (!isCodeBlock) {
          // For non-code blocks, insert HTML directly
        // Delete selected content if any
        if (!range.collapsed) {
          range.deleteContents();
        }
        
        // Create a temporary container to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Insert the nodes
        const fragment = document.createDocumentFragment();
        Array.from(tempDiv.childNodes).forEach(node => {
          fragment.appendChild(node.cloneNode(true));
        });
        
        range.insertNode(fragment);
        
        // Move cursor to end of inserted content
        range.setStartAfter(fragment.lastChild || fragment);
        range.collapse(true);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        
        // Update block HTML
        updateBlockHtml(id, element.innerHTML);
        }
      }
      
      // Sync block after paste
      setTimeout(() => {
        syncActiveBlock();
      }, 0);
    },
    [updateBlockHtml, updateBlockType, insertBlockAfter, sanitizeHtml, syncActiveBlock, setBlocks]
  );


  // Ensure command menu is fully visible when shown
  useEffect(() => {
    if (showCommandMenu && commandMenuRef.current) {
      // Use setTimeout to ensure menu is fully rendered
      const timeoutId = setTimeout(() => {
        if (commandMenuRef.current) {
          const menu = commandMenuRef.current;
          const menuRect = menu.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const menuBottom = menuRect.bottom;
          
          // If menu bottom exceeds viewport, scroll to show it
          if (menuBottom > viewportHeight - 16) {
            const scrollAmount = menuBottom - viewportHeight + 16;
            window.scrollBy({
              top: scrollAmount,
              behavior: 'smooth',
            });
          }
        }
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [showCommandMenu, commandMenuPosition]);

  // Close command menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        commandMenuRef.current &&
        !commandMenuRef.current.contains(event.target as Node)
      ) {
        const target = event.target as HTMLElement;
        if (!target.closest('[contenteditable="true"]')) {
          setShowCommandMenu(false);
          setCommandFilter('');
        }
      }
      
      // Close language selector when clicking outside
      if (
        languageSelectorRef.current &&
        !languageSelectorRef.current.contains(event.target as Node)
      ) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-block-id]')) {
          setShowLanguageSelector(null);
        }
      }
    };

    if (showCommandMenu || showLanguageSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCommandMenu, showLanguageSelector]);

  // Ensure at least one block exists
  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, blockId: string) => {
    setDraggedBlockId(blockId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockId);
    // Add a small delay to allow the drag image to be set
    setTimeout(() => {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    }, 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    if (!draggedBlockId || draggedBlockId === blockId) {
      setDragOverBlockId(null);
      setDragPosition(null);
      return;
    }
    
    setDragOverBlockId(blockId);
    
    // Determine if we should drop before or after based on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    const blockMiddle = rect.top + rect.height / 2;
    
    if (mouseY < blockMiddle) {
      setDragPosition('before');
    } else {
      setDragPosition('after');
    }
  }, [draggedBlockId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving the block area
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    if (mouseX < rect.left || mouseX > rect.right || mouseY < rect.top || mouseY > rect.bottom) {
      setDragOverBlockId(null);
      setDragPosition(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetBlockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedBlockId || draggedBlockId === targetBlockId) {
      setDraggedBlockId(null);
      setDragOverBlockId(null);
      setDragPosition(null);
      return;
    }
    
    if (dragPosition) {
      moveBlock(draggedBlockId, targetBlockId, dragPosition);
    }
    
    setDraggedBlockId(null);
    setDragOverBlockId(null);
    setDragPosition(null);
  }, [draggedBlockId, dragPosition, moveBlock]);

  const handleDragEnd = useCallback(() => {
    setDraggedBlockId(null);
    setDragOverBlockId(null);
    setDragPosition(null);
  }, []);

  const displayBlocks = blocks.length > 0 ? blocks : [createEmptyBlock()];

  // Handle block click for Ctrl/Cmd-click and Shift-click
  const handleBlockClick = useCallback((e: React.MouseEvent, blockId: string, blockIndex: number) => {
    // Don't interfere with text selection
    if (window.getSelection()?.toString()) {
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      // Ctrl/Cmd-click: toggle selection
      e.preventDefault();
      setSelectedBlockIds((prev) => {
        if (prev.includes(blockId)) {
          return prev.filter((id) => id !== blockId);
        } else {
          setLastSelectedIndex(blockIndex);
          return [...prev, blockId];
        }
      });
    } else if (e.shiftKey && lastSelectedIndex !== null) {
      // Shift-click: extend selection range
      e.preventDefault();
      const startIndex = Math.min(lastSelectedIndex, blockIndex);
      const endIndex = Math.max(lastSelectedIndex, blockIndex);
      const selectedIds = blocks.slice(startIndex, endIndex + 1).map((b) => b.id);
      setSelectedBlockIds(selectedIds);
    } else {
      // Regular click: single selection
      setSelectedBlockIds([blockId]);
      setLastSelectedIndex(blockIndex);
    }
  }, [blocks, lastSelectedIndex]);

  // Clear selection when clicking outside blocks
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const container = document.querySelector('[data-notion-editor-container]');
      if (container && !container.contains(target)) {
        setSelectedBlockIds([]);
        setLastSelectedIndex(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Notion-like: click on empty area (gutter / bottom padding) focuses the last block,
  // creating a new empty text block if the current last block is non-empty or non-text.
  const handleEmptyAreaClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-block-id]')) return;
    if (target.closest('button')) return;
    if (target.closest('a')) return;
    if (target.closest('[contenteditable="true"]')) return;
    if (target.closest('[role="button"]')) return;

    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;

    const focusBlock = (id: string) => {
      const el = blockRefs.current.get(id);
      if (el) {
        el.focus();
        placeCaretAtEnd(el);
      }
    };

    const lastBlock = blocks[blocks.length - 1];
    if (!lastBlock) {
      const fresh = createEmptyBlock('rich_text');
      setBlocks([fresh]);
      setTimeout(() => focusBlock(fresh.id), 0);
      return;
    }

    const lastIsEmptyText =
      isTextBlock(lastBlock.type) && isEmptyHtml(lastBlock.html || '');

    if (!lastIsEmptyText) {
      const fresh = createEmptyBlock('rich_text');
      setBlocks((prev) => [...prev, fresh]);
      setTimeout(() => focusBlock(fresh.id), 0);
    } else {
      focusBlock(lastBlock.id);
    }
  }, [blocks, setBlocks]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div
        ref={editorScrollRef}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain cursor-text"
        data-notion-editor-container
        onClick={handleEmptyAreaClick}
      >
        <div className="flex-1 min-w-0 pb-24">
          <div className="max-w-3xl mx-auto w-full py-10 px-8 space-y-0 relative">
          {displayBlocks.map((block, index) => {
            const isActive = block.id === activeBlockId;
            const isHovered = hoveredBlockId === block.id;
            const isDragged = draggedBlockId === block.id;
            const isDragOver = dragOverBlockId === block.id;
            const showDragIndicator = isDragOver && dragPosition && !isDragged;
            const isBulletedList = block.type === 'list';
            const isNumberedList = block.type === 'numbered_list';
            const isTodoList = block.type === 'todo_list';
            const isListBlock = isBulletedList || isNumberedList || isTodoList;
            const listMarker = isNumberedList
              ? `${getNumberedListIndex(blocks, index)}.`
              : '•';
            const todoChecked = isTodoList ? isTodoCheckedInHtml(block.html) : false;
            
            if (block.type === 'divider') {
              const isSelected = selectedBlockIds.includes(block.id);

              return (
                <div
                  key={block.id}
                  className={`group relative flex items-center ${
                    isSelected ? 'bg-[#3CCED7]/8' : ''
                  }`}
                  onMouseEnter={() => setHoveredBlockId(block.id)}
                  onMouseLeave={() => setHoveredBlockId(null)}
                  onDragOver={(e) => handleDragOver(e, block.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, block.id)}
                  onClick={(e) => handleBlockClick(e, block.id, index)}
                >
                  {/* Drag indicator line above */}
                  {showDragIndicator && dragPosition === 'before' && (
                    <div className="absolute -top-2 left-0 right-0 h-0.5 bg-[#3CCED7]/80 z-10" />
                  )}

                  <div className="flex items-center justify-between group w-full">
                    {/* Left sidebar with add button and drag handle */}
                    <div className="flex items-center gap-0.5 flex-shrink-0 mr-5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          insertBlockAfter(block.id, 'rich_text');
                        }}
                        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-[#3CCED7] transition-colors"
                        title="Add block below"
                        aria-label="Add block below"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => handleDragStart(e, block.id)}
                        onDragEnd={handleDragEnd}
                        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-grab active:cursor-grabbing"
                        title="Drag to reorder"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 py-2">
                      <hr className="w-full border-t border-gray-300 my-4" aria-hidden="true" />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="h-6 w-6 inline-flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition mr-1 flex-shrink-0"
                      aria-label="Remove divider"
                      title="Remove divider"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Drag indicator line below */}
                  {showDragIndicator && dragPosition === 'after' && (
                    <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#3CCED7]/80 z-10" />
                  )}
                </div>
              );
            }
            const isSelected = selectedBlockIds.includes(block.id);
            
            return (
              <div
                key={block.id}
                className={`group relative ${isDragged ? 'opacity-50' : ''} ${
                  isSelected ? 'bg-[#3CCED7]/8' : ''
                } ${block.type === 'table' ? 'mb-10 pb-10' : ''}`}
                onMouseEnter={() => setHoveredBlockId(block.id)}
                onMouseLeave={() => setHoveredBlockId(null)}
                onDragOver={(e) => handleDragOver(e, block.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, block.id)}
                onClick={(e) => handleBlockClick(e, block.id, index)}
                style={{
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                }}
              >
                {/* Drag indicator line above */}
                {showDragIndicator && dragPosition === 'before' && (
                  <div className="absolute -top-2 left-0 right-0 h-0.5 bg-[#3CCED7]/80 z-10" />
                )}
                
                <div className="flex items-center justify-between group w-full">
                  {/* Left sidebar with add button and drag handle */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 mr-5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        insertBlockAfter(block.id, 'rich_text');
                      }}
                      className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-[#3CCED7] transition-colors"
                      title="Add block below"
                      aria-label="Add block below"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => handleDragStart(e, block.id)}
                      onDragEnd={handleDragEnd}
                      className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-grab active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                  </div>
                  
                    <div className={`flex-1 py-1.5 relative min-w-0 ${block.type === 'table' ? 'px-1' : 'overflow-hidden'}`}>
                    {isListBlock && (
                      <div className="absolute left-0 top-1.5 w-6 h-6 flex items-center justify-center text-gray-500 z-20 pointer-events-auto">
                        {isTodoList ? (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleTodoState(block.id);
                            }}
                            className={`w-4 h-4 flex items-center justify-center border rounded ${
                              todoChecked ? 'bg-[#3CCED7]/80 border-[#3CCED7]' : 'border-gray-400'
                            }`}
                            aria-label={todoChecked ? 'Mark to-do incomplete' : 'Mark to-do complete'}
                          >
                            {todoChecked ? (
                              <svg
                                viewBox="0 0 16 16"
                                className="w-3 h-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M3 8l3 3 7-7" />
                              </svg>
                            ) : null}
                          </button>
                        ) : (
                          <span className="text-base leading-none pointer-events-none select-none">
                            {listMarker}
                          </span>
                        )}
                      </div>
                    )}
                    {isEmptyHtml(block.html) && !isListBlock && isTextBlock(block.type) ? (
                      <div className="absolute top-1.5 left-0 pointer-events-none select-none text-base leading-7 text-gray-400 z-0">
                        Type &apos;/&apos; for commands, press Enter to add a new block
                      </div>
                    ) : null}
                    {isEmptyHtml(block.html) && isListBlock ? (
                      <div className="absolute top-1.5 left-6 pointer-events-none select-none text-base leading-7 text-gray-400 z-0">
                        {isNumberedList ? 'Numbered item' : isTodoList ? 'To-do item' : 'List item'}
                      </div>
                    ) : null}
                    <div className={`relative min-w-0 ${block.type === 'table' ? 'group/table pr-10 pb-7' : ''} ${(block.type === 'image' || block.type === 'video' || block.type === 'audio' || block.type === 'file' || block.type === 'web_bookmark') ? 'group/media' : ''}`}>
                      {block.type === 'table' ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('Add column button clicked');
                              addTableColumn(block.id);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-12 rounded-md border border-gray-200 bg-gray-100 text-gray-500 shadow-sm opacity-0 group-hover/table:opacity-100 transition z-50 pointer-events-auto cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                            aria-label="Add column"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('Add row button clicked');
                              addTableRow(block.id);
                            }}
                            className="absolute left-1/2 bottom-0 -translate-x-1/2 w-16 h-7 rounded-md border border-gray-200 bg-gray-100 text-gray-500 shadow-sm opacity-0 group-hover/table:opacity-100 transition z-50 pointer-events-auto cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                            aria-label="Add row"
                          >
                            +
                          </button>
                        </>
                      ) : null}
                      {block.type === 'code' ? (
                        <div
                          ref={(node) => registerBlockRef(block.id, node)}
                          className="w-full relative z-10 group/code"
                          data-block-id={block.id}
                        >
                          {/* Language selector button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowLanguageSelector(showLanguageSelector === block.id ? null : block.id);
                            }}
                            className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-800 text-gray-300 rounded hover:bg-gray-700 opacity-0 group-hover/code:opacity-100 transition-opacity z-20"
                            title="Select language"
                          >
                            {block.language && block.language !== 'plain' ? block.language : 'Plain'}
                          </button>
                          
                          {/* Language selector dropdown */}
                          {showLanguageSelector === block.id && (
                            <div
                              ref={languageSelectorRef}
                              className="absolute top-10 right-2 bg-white border border-gray-200 rounded-md shadow-lg z-30 max-h-64 overflow-y-auto"
                              style={{ minWidth: '150px' }}
                            >
                              {commonLanguages.map((lang) => (
                                <button
                                  key={lang.value}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateBlockLanguage(block.id, lang.value);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                                    (block.language || 'plain') === lang.value ? 'bg-[#3CCED7]/8 text-[#3CCED7]' : ''
                                  }`}
                                >
                                  {lang.label}
                                </button>
                              ))}
                            </div>
                          )}
                          
                          <div className="relative">
                            {/* Highlighted code display (always visible, behind textarea) */}
                            <pre
                              ref={(preEl) => {
                                if (!preEl) return;
                                const codeEl = preEl.querySelector('code.hljs') as HTMLElement;
                                if (!codeEl) return;
                                
                                // Get raw text content from block.html (no HTML parsing)
                                const rawText = block.html || '';
                                
                                // Set textContent (NOT innerHTML) to prevent HTML parsing
                                if (codeEl.textContent !== rawText) {
                                  codeEl.textContent = rawText;
                                }
                                
                                // Apply highlight.js highlighting
                                if (rawText.trim() && hljsModule) {
                                  try {
                                    const highlighted = highlightedCode[block.id];
                                    if (highlighted) {
                                      // Use innerHTML only for the highlighted result (which is already HTML)
                                      codeEl.innerHTML = highlighted;
                                    } else {
                                      // If not highlighted yet, highlight it now
                                      const result = block.language && block.language !== 'plain'
                                        ? hljsModule.highlight(rawText, { language: block.language })
                                        : hljsModule.highlightAuto(rawText);
                                      codeEl.innerHTML = result.value;
                                      // Update highlightedCode state
                                      setHighlightedCode((prev) => ({
                                        ...prev,
                                        [block.id]: result.value,
                                      }));
                                    }
                                  } catch (error) {
                                    console.warn('Code highlighting failed:', error);
                                    // Fallback to plain text
                                    codeEl.textContent = rawText;
                                  }
                                } else if (!rawText.trim()) {
                                  codeEl.textContent = '';
                                }
                              }}
                              className={`font-mono text-sm bg-gray-900 text-gray-100 rounded-md overflow-x-auto w-full min-h-[120px] ${getBlockClassName(block.type)} pointer-events-none`}
                            style={{
                              whiteSpace: 'pre',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 1,
                                margin: 0,
                                padding: '1rem',
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                fontSize: '0.875rem',
                                lineHeight: '1.75rem',
                                overflowY: 'auto',
                                boxSizing: 'border-box',
                                letterSpacing: 'normal',
                                wordSpacing: 'normal',
                                textIndent: 0,
                                textTransform: 'none',
                                textShadow: 'none',
                              }}
                            >
                              <code
                                className="hljs"
                                style={{
                                  display: 'block',
                                  whiteSpace: 'pre',
                                  fontFamily: 'inherit',
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit',
                                  letterSpacing: 'inherit',
                                  wordSpacing: 'inherit',
                                  margin: 0,
                                  padding: 0,
                                }}
                              />
                            </pre>
                            {/* Editable textarea (always present, on top) */}
                            <textarea
                              ref={(node) => {
                                if (node && activeBlockId === block.id) {
                                  // Auto-resize to fit content
                                  node.style.height = 'auto';
                                  const scrollHeight = node.scrollHeight;
                                  node.style.height = `${Math.max(scrollHeight, 60)}px`;
                                }
                              }}
                              value={block.html || ''}
                              onChange={(e) => {
                                const textContent = e.target.value;
                                updateBlockHtml(block.id, textContent);
                                
                                // Auto-resize textarea
                                e.target.style.height = 'auto';
                                const scrollHeight = e.target.scrollHeight;
                                e.target.style.height = `${Math.max(scrollHeight, 60)}px`;
                                
                                // Auto-detect language if not set
                                if (textContent.trim() && (!block.language || block.language === 'plain')) {
                                  detectLanguageForCodeBlock(block.id, textContent);
                                }
                                // Sync scroll
                                const element = blockRefs.current.get(block.id);
                                if (element) {
                                  const pre = element.querySelector('pre:not(textarea)');
                                  if (pre) {
                                    pre.scrollTop = e.target.scrollTop;
                                    pre.scrollLeft = e.target.scrollLeft;
                                  }
                                }
                              }}
                              onBlur={() => {
                                // Auto-detect language if not set
                                if (block.html && (!block.language || block.language === 'plain')) {
                                  detectLanguageForCodeBlock(block.id, block.html);
                                }
                              }}
                              onFocus={(e) => {
                                setActiveBlockId(block.id);
                                // Auto-resize on focus
                                const textarea = e.currentTarget;
                                textarea.style.height = 'auto';
                                const scrollHeight = textarea.scrollHeight;
                                textarea.style.height = `${Math.max(scrollHeight, 120)}px`;
                              }}
                              onScroll={(e) => {
                                // Sync scroll with highlighted display
                                const element = blockRefs.current.get(block.id);
                                if (element) {
                                  const pre = element.querySelector('pre:not(textarea)');
                                  if (pre) {
                                    pre.scrollTop = e.currentTarget.scrollTop;
                                    pre.scrollLeft = e.currentTarget.scrollLeft;
                                  }
                                }
                              }}
                              onMouseDown={(e) => {
                                // Use native textarea click handling for accurate cursor positioning
                                e.stopPropagation();
                                if (activeBlockId !== block.id) {
                                  setActiveBlockId(block.id);
                                  setTimeout(() => {
                                    const element = blockRefs.current.get(block.id);
                                    if (element) {
                                      const textarea = element.querySelector('textarea') as HTMLTextAreaElement;
                                      if (textarea) {
                                        textarea.readOnly = false;
                                        textarea.focus();
                                      }
                                    }
                                  }, 0);
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                            }}
                            onKeyDown={(event) => handleKeyDown(block.id, event as any)}
                              onPaste={(event) => {
                                // For code blocks, always use plain text only - prevent HTML parsing
                                event.preventDefault();
                                event.stopPropagation(); // Prevent event from bubbling to handlePaste
                                
                                const clipboardData = event.clipboardData;
                                // ONLY use text/plain - never use text/html to avoid parsing
                                const plainText = clipboardData.getData('text/plain');
                                
                                // If no plain text available, return early
                                if (!plainText) {
                                  return;
                                }
                                
                                const textarea = event.currentTarget as HTMLTextAreaElement;
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const currentValue = textarea.value;
                                const newValue = currentValue.slice(0, start) + plainText + currentValue.slice(end);
                                
                                // Update textarea value with raw text
                                textarea.value = newValue;
                                
                                // Set cursor position
                                const newCursorPos = start + plainText.length;
                                textarea.setSelectionRange(newCursorPos, newCursorPos);
                                
                                // Update block HTML with plain text (raw code, no HTML parsing)
                                updateBlockHtml(block.id, newValue);
                                
                                // Auto-resize after paste
                                setTimeout(() => {
                                  textarea.style.height = 'auto';
                                  const scrollHeight = textarea.scrollHeight;
                                  textarea.style.height = `${Math.max(scrollHeight, 120)}px`;
                                  
                                  // Sync scroll
                                  const element = blockRefs.current.get(block.id);
                                  if (element) {
                                    const pre = element.querySelector('pre:not(textarea)');
                                    if (pre) {
                                      pre.scrollTop = textarea.scrollTop;
                                      pre.scrollLeft = textarea.scrollLeft;
                                    }
                                  }
                                }, 0);
                                
                                // Auto-detect language after paste
                                if (newValue.trim() && (!block.language || block.language === 'plain')) {
                                  detectLanguageForCodeBlock(block.id, newValue);
                                }
                              }}
                              className={`font-mono text-sm rounded-md overflow-x-auto w-full min-h-[120px] focus:outline-none ${getBlockClassName(block.type)} relative z-10 resize-none border-none`}
                              style={{
                                caretColor: '#fff',
                                whiteSpace: 'pre',
                                position: 'relative',
                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                fontSize: '0.875rem',
                                lineHeight: '1.75rem',
                                color: 'transparent',
                                background: 'transparent',
                                padding: '1rem',
                                margin: 0,
                                overflowY: 'auto',
                                maxHeight: 'none',
                                boxSizing: 'border-box',
                                // Ensure textarea and pre have identical styling
                                letterSpacing: 'normal',
                                wordSpacing: 'normal',
                                textIndent: 0,
                                textTransform: 'none',
                                textShadow: 'none',
                              }}
                              spellCheck={false}
                              wrap="off"
                              readOnly={activeBlockId !== block.id}
                            />
                          </div>
                        </div>
                      ) : block.type === 'video' ? (
                        <VideoBlock
                          blockId={block.id}
                          html={block.html}
                          onRef={(node) => registerBlockRef(block.id, node)}
                          onClick={() => setActiveBlockId(block.id)}
                          className={`w-full focus:outline-none ${getBlockClassName(block.type)} relative z-10`}
                        />
                      ) : (block.type === 'image' || block.type === 'audio' || block.type === 'file' || block.type === 'web_bookmark') ? (
                        <div
                          ref={(node) => registerBlockRef(block.id, node)}
                          className={`w-full focus:outline-none ${getBlockClassName(block.type)} relative z-10`}
                          data-block-id={block.id}
                          onClick={() => setActiveBlockId(block.id)}
                          dangerouslySetInnerHTML={{ __html: block.html || '' }}
                        />
                      ) : (
                        <div
                          ref={(node) => registerBlockRef(block.id, node)}
                          contentEditable
                          suppressContentEditableWarning
                          className={`w-full min-h-[1.5rem] focus:outline-none ${getBlockClassName(block.type)} relative z-10 [&_a]:text-[#3CCED7] [&_a]:underline [&_a:hover]:text-blue-800 ${
                            block.type === 'table' ? 'border border-gray-200 rounded-md bg-white overflow-x-auto overflow-y-visible' : ''
                          }`}
                          data-block-id={block.id}
                          style={{
                            caretColor: '#000',
                            userSelect: 'text',
                            WebkitUserSelect: 'text',
                            MozUserSelect: 'text',
                            msUserSelect: 'text',
                            ...(isListBlock ? { paddingLeft: '1.5rem' } : {}),
                            ...(block.type === 'table' ? { width: '100%', display: 'block' } : {}),
                          }}
                          onFocus={() => {
                            setActiveBlockId(block.id);
                          }}
                          onBlur={(e) => {
                          // Don't blur if selection is being made across blocks
                          const selection = window.getSelection();
                          if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            const container = document.querySelector('[data-notion-editor-container]') as HTMLElement;
                            if (container) {
                              const allBlocks = Array.from(container.querySelectorAll('[data-block-id]')) as HTMLElement[];
                              const findBlock = (node: Node): HTMLElement | null => {
                                let current: Node | null = node;
                                while (current) {
                                  if (current.nodeType === Node.ELEMENT_NODE) {
                                    const element = current as HTMLElement;
                                    if (element.hasAttribute('data-block-id')) {
                                      return element;
                                    }
                                  }
                                  current = current.parentNode;
                                }
                                return null;
                              };
                              const startBlock = findBlock(range.startContainer);
                              const endBlock = findBlock(range.endContainer);
                              if (startBlock && endBlock && startBlock !== endBlock) {
                                // Selection spans multiple blocks - don't blur
                                e.preventDefault();
                                return;
                              }
                            }
                          }
                          syncActiveBlock();
                        }}
                        onInput={(event) => {
                          const element = event.currentTarget;
                          if (element.innerHTML === '<br>' || element.innerHTML === '<div><br></div>') {
                            element.innerHTML = '';
                          }
                          handleInput(block.id, event);
                        }}
                        onKeyDown={(event) => handleKeyDown(block.id, event)}
                        onPaste={(event) => handlePaste(block.id, event)}
                        role="textbox"
                        aria-multiline
                      />
                      )}
                      {/* Remove any delete buttons that might be inside media blocks HTML content */}
                      {(block.type === 'image' || block.type === 'video' || block.type === 'audio' || block.type === 'file' || block.type === 'web_bookmark') && (
                        <style dangerouslySetInnerHTML={{
                          __html: `
                            [data-block-id="${block.id}"] button[aria-label*="Delete"],
                            [data-block-id="${block.id}"] button[aria-label*="delete"],
                            [data-block-id="${block.id}"] button[title*="Delete"],
                            [data-block-id="${block.id}"] button[title*="delete"] {
                              display: none !important;
                            }
                          `
                        }} />
                      )}
                    </div>
                  </div>
                  {/* Delete button for all blocks - unified position on the right, same as divider */}
                  {block.type !== 'divider' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlock(block.id);
                      }}
                      className="h-6 w-6 inline-flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition mr-1 flex-shrink-0"
                      aria-label={`Delete ${block.type}`}
                      title={`Delete ${block.type}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Drag indicator line below */}
                {showDragIndicator && dragPosition === 'after' && (
                  <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-[#3CCED7]/80 z-10" />
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      <OutlineOverlay
        items={outlineItems}
        activeId={activeOutlineId}
        hoveredId={hoveredOutlineId}
        setHoveredId={setHoveredOutlineId}
        onItemClick={handleOutlineClick}
        editorScrollRef={editorScrollRef}
      />

      {/* Command Menu */}
      {showCommandMenu && activeBlockId && (
        <div
          ref={commandMenuRef}
          className="fixed bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
          style={{
            top: `${commandMenuPosition.top}px`,
            left: `${commandMenuPosition.left}px`,
            minWidth: '280px',
            maxWidth: '320px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 9999,
          }}
        >
          <div className="p-2">
            {/* Basic blocks section */}
            {filteredBasicBlocks.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Basic blocks
                </div>
                {filteredBasicBlocks.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleCommandSelect(option)}
                    className={`w-full flex items-start gap-3 px-3 py-2 text-left rounded hover:bg-gray-100 transition-colors ${
                      index === selectedCommandIndex ? 'bg-gray-100' : ''
                    }`}
                    onMouseEnter={() => setSelectedCommandIndex(index)}
                  >
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-600 text-sm font-medium">
                      {typeof option.icon === 'string' ? option.icon : (option.icon || '•')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {option.label}
                      </div>
                      {option.description && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Media blocks section */}
            {filteredMediaBlocks.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-t border-gray-100 mt-1 pt-2">
                  Media
                </div>
                {filteredMediaBlocks.map((option, index) => {
                  const globalIndex = filteredBasicBlocks.length + index;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleCommandSelect(option)}
                      className={`w-full flex items-start gap-3 px-3 py-2 text-left rounded hover:bg-gray-100 transition-colors ${
                        globalIndex === selectedCommandIndex ? 'bg-gray-100' : ''
                      }`}
                      onMouseEnter={() => setSelectedCommandIndex(globalIndex)}
                    >
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-600 text-sm font-medium">
                        {typeof option.icon === 'string' ? option.icon : (option.icon || '•')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {option.label}
                        </div>
                        {option.description && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {/* No commands found */}
            {filteredBasicBlocks.length === 0 && filteredMediaBlocks.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">
                No commands found
              </div>
            )}
          </div>
          <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
            <span>Type &apos;/&apos; on the page</span>
            <span>esc</span>
          </div>
        </div>
      )}
    </div>
  );
}

