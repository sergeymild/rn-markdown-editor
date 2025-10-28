import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkHtml from 'remark-html';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';

export const markdownToHtml = async (markdown: string) => {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml)
    .process(markdown);

  return String(result);
};

export const htmlToMarkdown = async (html: string) => {
  try {
    console.log('[Markdown.htmlToMarkdown]', html)
    const result = await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeRemark)
      .use(remarkGfm)
      .use(remarkStringify)
      .process(html);
    console.log('[Markdown.htmlToMarkdown]', String(result))
    return String(result);
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error);
    // Fallback: return the original HTML if conversion fails
    return html;
  }
};
