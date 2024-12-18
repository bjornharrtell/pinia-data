import {
  Model,
  hasMany,
  belongsTo,
  model
} from '../src/pinia-data'
import type { JsonApiDocument, JsonApiResource, JsonApiResourceIdentifier } from '../src/json-api'
import type { JsonApiFetcher } from '../src/json-api-fetcher'
import doc from './articles.json'

export class JsonApiFetcherArticles implements JsonApiFetcher {
  doc: JsonApiDocument
  articles: JsonApiResource[]
  included: JsonApiResource[]
  constructor() {
    this.doc = doc as JsonApiDocument
    this.articles = this.doc.data as JsonApiResource[]
    this.included = this.doc.included as JsonApiResource[]
  }
  async fetchAll(type: string): Promise<JsonApiResource[]> {
    if (type !== 'article') throw new Error(`Type ${type} not supported`)
    return this.articles
  }
  async fetchOne(type: string, id: string): Promise<JsonApiResource> {
    if (type !== 'article') throw new Error(`Type ${type} not supported`)
    const article = this.articles.find((a) => a.id === id)
    if (!article) throw new Error(`Article ${id} not found`)
    return article
  }
  async fetchHasMany(type: string, id: string, name: string): Promise<JsonApiResource[]> {
    if (type !== 'article') throw new Error(`Type ${type} not supported`)
    const article = this.articles.find((a) => a.id === id)
    if (!article) throw new Error(`Article ${id} not found`)
    const relationship = article.relationships[name]
    if (!relationship) throw new Error(`Relationship ${name} not found`)
    if (!relationship.data) throw new Error(`Relationship data unexpectedly null`)
    const findIncluded = (rid: JsonApiResourceIdentifier) => {
      const resource = this.included.find((i) => i.id === rid.id)
      if (!resource) throw new Error(`Resource ${id} not found`)
      return resource
    }
    const rids = relationship.data as JsonApiResourceIdentifier[]
    const related = rids.map(findIncluded)
    return related
  }
  async fetchBelongsTo(type: string, id: string, name: string): Promise<JsonApiResource> {
    if (type !== 'article') throw new Error(`Type ${type} not supported`)
    const article = this.articles.find((a) => a.id === id)
    if (!article) throw new Error(`Article ${id} not found`)
    const relationship = article.relationships[name]
    if (!relationship) throw new Error(`Relationship ${name} not found`)
    if (!relationship.data) throw new Error(`Relationship data unexpectedly null`)
    const findIncluded = (rid: JsonApiResourceIdentifier) => {
      const resource = this.included.find((i) => i.id === rid.id)
      if (!resource) throw new Error(`Resource ${id} not found`)
      return resource
    }
    const rid = relationship.data as JsonApiResourceIdentifier
    const related = findIncluded(rid)
    return related
  }
}

@model('person')
export class Person extends Model {
  firstName?: string
  lastName?: string
  twitter?: string
}

@model('comment')
export class Comment extends Model {
  body?: string
}

@model('article')
export class Article extends Model {
  title?: string
  @belongsTo(Person) author: Person | null = null
  @hasMany(Comment) comments: Comment[] = []
}