import { watch, nextTick, toRaw } from 'vue'

export class IndexedDB {
  constructor(
    public readonly name: string,
    public readonly alias?: string
  ) {}
  private DBList: Record<
    string,
    {
      data: Record<string, any>
      key: string
      cb?: () => void
    }
  > = {}
  private hasDB = true
  db?: IDBDatabase

  private index = 0

  private setWatch = (key: string) => {
    this.DBList[key]?.cb?.()
    watch(this.DBList[key].data[this.DBList[key].key], () => {
      nextTick(() => {
        this.updateDB(key)
      })
    })
  }

  private updateDB = (key: string) => {
    if (this.db) {
      this.db
        .transaction('data', 'readwrite')
        .objectStore('data')
        .put(JSON.parse(JSON.stringify(toRaw(this.DBList[key].data[this.DBList[key].key]))), key)
    }
  }

  add = <T extends { [name: string]: any }, K extends keyof T & string>(data: {
    data: T
    key: K
    name?: string
    cb?: () => void
  }) => {
    if (data.name) {
      if (!(data.name in this.DBList)) {
        this.DBList[data.name] = {
          data: data.data,
          key: data.key,
          cb: data.cb
        }
      }
    } else {
      let has = false
      for (const i in this.DBList) {
        if (this.DBList[i].data === data.data && this.DBList[i].key === data.key) {
          has = true
          break
        }
      }
      if (!has) {
        this.DBList[this.index++] = {
          data: data.data,
          key: data.key,
          cb: data.cb
        }
      }
    }
    return this
  }

  save = () => {
    return new Promise<void>((resolve, reject) => {
      try {
        console.log(`正在加${this.alias}数据库...`)
        const _db = window.indexedDB.open(this.name)
        _db.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result
          if (this.hasDB) {
            for (const key in this.DBList) {
              this.db.transaction('data', 'readonly').objectStore('data').get(key).onsuccess = (
                res
              ) => {
                try {
                  const data = (res.target as IDBRequest).result
                  if (data) {
                    this.DBList[key].data[this.DBList[key].key] = data
                  }
                } finally {
                  this.setWatch(key)
                }
              }
            }
          } else {
            for (const key in this.DBList) {
              this.updateDB(key)
              this.setWatch(key)
            }
          }
          resolve()
        }

        _db.onupgradeneeded = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result
          if (!this.db.objectStoreNames.contains('data')) {
            this.hasDB = false
            this.db.createObjectStore('data')
          }
        }
      } catch (err) {
        reject(err)
      }
    })
  }
}
