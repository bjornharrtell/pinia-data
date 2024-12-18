import { describe, expect, test, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { setActivePinia, createPinia } from 'pinia'
import {
  definePiniaDataStore,
  JsonApiDocument,
  JsonApiFetcher,
  JsonApiResource,
  JsonApiResourceIdentifier,
  Model,
  hasMany,
  model
} from '../src/pinia-data'

setActivePinia(createPinia())

class JsonApiFetcherMock implements JsonApiFetcher {
  doc: JsonApiDocument
  articles: JsonApiResource[]
  included: JsonApiResource[]
  constructor() {
    this.doc = JSON.parse(readFileSync('tests/articles.json', 'utf-8')) as JsonApiDocument
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
  async fetchRelated(type: string, id: string, name: string): Promise<JsonApiResource[]> {
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
}

@model('person')
class Person extends Model {
  firstName?: string
  lastName?: string
  twitter?: string
}

@model('comment')
class Comment extends Model {
  body?: string
}

@model('article')
class Article extends Model {
  title?: string
  author: Person | null = null
  @hasMany(Comment)
  comments: Comment[] = []
}

const models = [Person, Comment, Article]

const usePiniaDataStore = definePiniaDataStore(
  'pinia-data',
  { endpoint: 'http://localhost:3000', models },
  new JsonApiFetcherMock(),
)

describe('Pinia Data Store', () => {
  beforeEach(() => {
    const { unloadAll } = usePiniaDataStore()
    unloadAll()
  })

  test('roundtrip record', async () => {
    const { createRecord, findRecord } = usePiniaDataStore()
    const person = createRecord(Person, { firstName: 'test' })
    const foundPerson = await findRecord(Person, person.id)
    expect(foundPerson.id).toBe(person.id)
    expect(foundPerson.firstName).toBe(person.firstName)
  })

  test('single record fetch', async () => {
    const { findRecord, findRelated } = usePiniaDataStore()
    const article = await findRecord(Article, '1')
    expect(article.id).toBe('1')
    expect(article.title).toBe('JSON:API paints my bikeshed!')
    await findRelated(article, 'comments')
    expect(article.comments.length).toBe(2)
    expect(article.comments[0].body).toBe('First!')
    expect(article.comments[1].body).toBe('I like XML better')
  })

  test('all records fetch', async () => {
    const { findAll, findRelated } = usePiniaDataStore()
    const articles = await findAll(Article)
    expect(articles.length).toBe(1)
    const article = articles[0]
    expect(article.id).toBe('1')
    expect(article.title).toBe('JSON:API paints my bikeshed!')
    await findRelated(article, 'comments')
    expect(article.comments.length).toBe(2)
    expect(article.comments[0].body).toBe('First!')
    expect(article.comments[1].body).toBe('I like XML better')
  })
})
