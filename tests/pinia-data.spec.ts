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
  ModelDefinition,
} from '../src/pinia-data'
import { ComputedRef } from 'vue'

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

class Article extends Model {
  title!: string
  author!: ComputedRef<Promise<Person>>
  comments!: ComputedRef<Promise<Comment[]>>
}
class Person extends Model {
  firstName!: string
  lastName!: string
  twitter!: string
}
class Comment extends Model {
  body!: string
}

const modelDefinitions: ModelDefinition[] = [
  {
    type: 'article',
    ctor: Article,
    hasMany: new Map([['comments', 'comment']]),
    belongsTo: new Map([['author', 'person']]),
  },
  {
    type: 'person',
    ctor: Person,
    hasMany: new Map(),
    belongsTo: new Map(),
  },
  {
    type: 'comment',
    ctor: Comment,
    hasMany: new Map(),
    belongsTo: new Map(),
  },
]

const usePiniaDataStore = definePiniaDataStore(
  { endpoint: new URL('http://localhost:3000'), modelDefinitions },
  new JsonApiFetcherMock(),
)

describe('Pinia Data Store', () => {
  beforeEach(() => {
    const { unloadAll } = usePiniaDataStore()
    unloadAll()
  })

  test('roundtrip record', async () => {
    const { createRecord, findRecord } = usePiniaDataStore()
    const person = createRecord<Person>('person', { firstName: 'test' })
    const foundPerson = await findRecord<Person>('person', person.id)
    expect(foundPerson.id).toBe(person.id)
    expect(foundPerson.firstName).toBe(person.firstName)
  })

  test('single record fetch', async () => {
    const { findRecord } = usePiniaDataStore()
    const article = await findRecord<Article>('article', '1')
    expect(article.id).toBe('1')
    expect(article.title).toBe('JSON:API paints my bikeshed!')
    const comments = await article.comments.value
    expect(comments.length).toBe(2)
    expect(comments[0].body).toBe('First!')
    expect(comments[1].body).toBe('I like XML better')
  })

  test('single record fetch', async () => {
    const { findRecord } = usePiniaDataStore()
    const article = await findRecord<Article>('article', '1')
    expect(article.id).toBe('1')
    expect(article.title).toBe('JSON:API paints my bikeshed!')
    const comments = await article.comments.value
    expect(comments.length).toBe(2)
    expect(comments[0].body).toBe('First!')
    expect(comments[1].body).toBe('I like XML better')
  })

  test('all records fetch', async () => {
    const { findAll } = usePiniaDataStore()
    const articles = await findAll<Article>('article')
    expect(articles.length).toBe(1)
    const article = articles[0]
    expect(article.id).toBe('1')
    expect(article.title).toBe('JSON:API paints my bikeshed!')
    const comments = await article.comments.value
    expect(comments.length).toBe(2)
    expect(comments[0].body).toBe('First!')
    expect(comments[1].body).toBe('I like XML better')
  })
})
