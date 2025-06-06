import rehypeRewrite from "rehype-rewrite"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import type { Compatible } from "vfile"

export const mdToHTML = (content: Compatible | undefined) =>
  unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .use(rehypeRewrite, {
      rewrite: (node, _index, _parent) => {
        if (node.type === "element" && node.tagName === "a") {
          node.properties.target = "_blank"
          node.properties.rel = "noopener noreferrer"
        }
        return node
      },
    })
    .process(content)
