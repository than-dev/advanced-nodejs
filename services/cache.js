const mongoose = require('mongoose');
const redis = require('redis')
const { promisify } = require('util')

const redisUrl = 'redis://127.0.0.1:6379'
const client = redis.createClient(redisUrl)
client.hget = promisify(client.hget)
const exec = mongoose.Query.prototype.exec

mongoose.Query.prototype.cache = function (options = {}) {
    this.useCache = true
    this.hashKey = JSON.stringify(options.key || '')

    return this
}

mongoose.Query.prototype.exec = async function () {
    if (!this.useCache) {
        return exec.apply(this, arguments)
    }

    const key = JSON.stringify(Object.assign({}, this.getQuery(), {
        collection: this.mongooseCollection.name
    }))

    const cacheValue = await client.hget(this.hashKey, key)

    if (cacheValue) {
        console.log('Served from cache:', cacheValue);

        return await JSON.parse(cacheValue)
    }

    
    const result = await exec.apply(this, arguments)
    
    client.hset(this.hashKey, key, JSON.stringify(result))

    return result
}

module.exports = {
    clearHash(hashKey) {
        client.del(JSON.stringify(hashKey))
    }
}