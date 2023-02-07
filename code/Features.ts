import { imemo } from "./utils"
import { FeatureSummary } from "./Interfaces"
const lodash = require("lodash")
const { Utils } = require("jtree/products/Utils")

const { shiftRight, removeReturnChars } = Utils

const linkManyAftertext = (links: string[]) =>
  links.map((link, index) => `${index + 1}.`).join(" ") + // notice the dot is part of the link. a hack to make it more unique for aftertext matching.
  links.map((link, index) => `\n ${link} ${index + 1}.`).join("")

// One feature maps to one grammar file that extends abstractFeatureNode
class Feature {
  constructor(node: any, collection: FeaturesCollection) {
    this.node = node
    this.collection = collection
    this.fileName = this.id + ".grammar"
  }

  fileName: string

  get permalink() {
    return this.id + ".html"
  }

  @imemo
  get id() {
    return this.node.id.replace("Node", "")
  }

  previous: Feature
  next: Feature

  node: any
  collection: FeaturesCollection

  get yes() {
    return this.languagesWithThisFeature.length
  }

  get no() {
    return this.languagesWithoutThisFeature.length
  }

  @imemo
  get measurements() {
    const { yes, no } = this
    return yes + no
  }

  get percentage() {
    const { yes, no } = this
    const measurements = yes + no
    return measurements < 100
      ? "-"
      : lodash.round((100 * yes) / measurements, 0) + "%"
  }

  @imemo
  get aka() {
    return this.get("aka") // .join(" or "),
  }

  @imemo
  get token() {
    return this.get("tokenKeyword")
  }

  @imemo
  get titleLink() {
    return `../features/${this.permalink}`
  }

  @imemo
  get _getLanguagesWithThisFeatureResearched() {
    const { id } = this
    return this.base.topLanguages.filter(file =>
      file.extendedFeaturesNode.has(id)
    )
  }

  get(word: string): string {
    return this.node.getFrom(`string ${word}`)
  }

  @imemo
  get title() {
    return this.get("title") || this.id
  }

  @imemo
  get pseudoExample() {
    return (this.get("pseudoExample") || "")
      .replace(/\</g, "&lt;")
      .replace(/\|/g, "&#124;")
  }

  @imemo
  get references() {
    return (this.get("reference") || "").split(" ").filter(i => i)
  }

  get base() {
    return this.collection.base
  }

  @imemo
  get languagesWithThisFeature() {
    const { id } = this
    return this._getLanguagesWithThisFeatureResearched.filter(
      file => file.extendedFeaturesNode.get(id) === "true"
    )
  }

  @imemo
  get languagesWithoutThisFeature() {
    const { id } = this
    return this._getLanguagesWithThisFeatureResearched.filter(
      file => file.extendedFeaturesNode.get(id) === "false"
    )
  }

  @imemo get summary(): FeatureSummary {
    const {
      id,
      title,
      fileName,
      titleLink,
      aka,
      token,
      yes,
      no,
      measurements,
      percentage,
      pseudoExample
    } = this
    return {
      id,
      title,
      fileName,
      titleLink,
      aka,
      token,
      yes,
      no,
      measurements,
      percentage,
      pseudoExample
    }
  }

  toScroll() {
    const { title, id, fileName, references, previous, next } = this

    const positives = this.languagesWithThisFeature
    const positiveText = `* Languages *with* ${title} include ${positives
      .map(file => `<a href="../languages/${file.permalink}">${file.title}</a>`)
      .join(", ")}`

    const negatives = this.languagesWithoutThisFeature
    const negativeText = negatives.length
      ? `* Languages *without* ${title} include ${negatives
          .map(
            file => `<a href="../languages/${file.permalink}">${file.title}</a>`
          )
          .join(", ")}`
      : ""

    const examples = positives
      .filter(file => file.extendedFeaturesNode.getNode(id).length)
      .map(file => {
        return {
          id: file.id,
          title: file.title,
          example: file.extendedFeaturesNode.getNode(id).childrenToString()
        }
      })
    const grouped = lodash.groupBy(examples, "example")
    const examplesText = Object.values(grouped)
      .map((group: any) => {
        const links = group
          .map(hit => `<a href="../languages/${hit.id}.html">${hit.title}</a>`)
          .join(", ")
        return `codeWithHeader Example from ${links}:
 ${shiftRight(removeReturnChars(lodash.escape(group[0].example)), 1)}`
      })
      .join("\n\n")

    let referencesText = ""
    if (references.length)
      referencesText = `* Read more about ${title} on the web: ${linkManyAftertext(
        references
      )}`

    let descriptionText = ""
    const description = this.node.get(`description`)
    if (description) descriptionText = `* This question asks: ${description}`

    return `import header.scroll

title ${title}

title ${title} - language feature
 hidden

html
 <a class="prevLang" href="${previous.permalink}">&lt;</a>
 <a class="nextLang" href="${next.permalink}">&gt;</a>

viewSourceUrl https://github.com/breck7/pldb/blob/main/database/grammar/${fileName}

startColumns 4

${examplesText}

${positiveText}

${negativeText}

${descriptionText}

${referencesText}

* HTML of this page generated by Features.ts
 https://github.com/breck7/pldb/blob/main/code/Features.ts Features.ts

endColumns

keyboardNav ${previous.permalink} ${next.permalink}

import ../footer.scroll
`.replace(/\n\n\n+/g, "\n\n")
  }
}

class FeaturesCollection {
  base: any
  features: Feature[]
  constructor(base: any) {
    this.base = base

    const allGrammarNodes = Object.values(
      base
        .nodeAt(0)
        .parsed.getDefinition()
        ._getProgramNodeTypeDefinitionCache()
    )

    this.features = allGrammarNodes
      .filter((node: any) => node.get("extends") === "abstractFeatureNode")
      .map(nodeDef => {
        const feature = new Feature(nodeDef, this)
        if (!feature.title) {
          throw new Error(`Feature ${nodeDef.toString()} has no title.`)
        }
        return feature
      })

    let previous = this.features[this.features.length - 1]
    this.features.forEach((feature: Feature, index: number) => {
      feature.previous = previous
      feature.next = this.features[index + 1]
      previous = feature
    })
    this.features[this.features.length - 1].next = this.features[0]
  }
}

export { FeaturesCollection }
