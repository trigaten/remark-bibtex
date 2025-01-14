import * as fs from 'fs'
import { Cite } from '@citation-js/core'
import '@citation-js/plugin-bibtex'
import '@citation-js/plugin-csl'
import { visit } from 'unist-util-visit'

export default function remarkBibtex(pluginOptions) {
  // the bibtex filepath is mandatory
  if (!('bibtexFile' in pluginOptions))
    throw new Error(
      'Options requires a "bibtexFile" key with a filepath to the .bib file as a value.'
    )
  // regex for identifying citation keys - use double escape to prevent prettier auto-removing
  const regexp = new RegExp('\\(\\@(.*?)\\)')
  // transformer
  async function transformer(markdownAST) {
    // read-in bibtex
    const bibtexFile = await fs.promises.readFile(pluginOptions.bibtexFile, 'utf8')
    // this is the citation-js instance
    const citations = new Cite(bibtexFile)
    // keep track of unique references
    const uniqueCiteRefs = []
    // visit nodes to find and extract citations
    visit(markdownAST, 'text', (node, idx, parent) => {
      // extract the starting and ending string indices for found citation keys
      const match = node.value.match(regexp)
      // abort if no matches found
      if (!match) return
      // split existing child into new children
      const citeStartIdx = match.index
      const citeEndIdx = match.index + match[0].length
      const newChildren = []
      // if preceding string
      if (citeStartIdx !== 0) {
        // create a new child node
        newChildren.push({
          type: 'text',
          value: node.value.slice(0, citeStartIdx).trimEnd(),
        })
      }
      // create the citation reference
      const citeRef = match[1]
      let footnoteKey
      // label depends if new or not
      if (!uniqueCiteRefs.includes(citeRef)) {
        footnoteKey = uniqueCiteRefs.length + 1
        uniqueCiteRefs.push(citeRef)
      } else {
        footnoteKey = uniqueCiteRefs.indexOf(citeRef) + 1
      }
      // add
      const citeNode = {
        type: 'footnoteReference',
        identifier: footnoteKey,
        label: footnoteKey,
      }
      newChildren.push(citeNode)
      // if trailing string
      if (citeEndIdx < node.value.length) {
        newChildren.push({
          type: 'text',
          value: node.value.slice(citeEndIdx),
        })
      }
      // insert into the parent
      parent.children = [
        ...parent.children.slice(0, idx),
        ...newChildren,
        ...parent.children.slice(idx + 1),
      ]
    })
    // add the footnotes
    // generate the bib text
    // https://citation.js.org/api/0.3/tutorial-output_formats.html
    uniqueCiteRefs.forEach((citeRef, idx) => {
      const cited = citations.format('bibliography', {
        format: 'text',
        template: pluginOptions.template || "apa",
        entry: citeRef,
      })
      // add to footnotes
      markdownAST.children.push({
        type: 'footnoteDefinition',
        identifier: idx + 1,
        label: idx + 1,
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                value: cited,
              },
            ],
          },
        ],
      })
    })
    return markdownAST
  }
  return transformer
}
