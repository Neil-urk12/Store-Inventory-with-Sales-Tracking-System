/**
 * @fileoverview Implements a Least Recently Used (LRU) cache with a doubly linked list and hash map.
 * The cache maintains items in order of use, removing least recently used items when capacity is reached.
 */

/**
 * Node class for doubly linked list implementation
 * @class
 */
class Node {
    /**
     * Creates a new Node
     * @param {*} key - The key to store
     * @param {*} value - The value associated with the key
     */
    constructor(key, value) {
        this.key = key
        this.value = value
        this.prev = null
        this.next = null
    }
}

/**
 * LRU Cache implementation using a doubly linked list and hash map
 * @class
 */
class LRUCache {
    /**
     * Creates a new LRU Cache
     * @param {number} capacity - Maximum number of items the cache can hold
     */
    constructor(capacity) {
        this.capacity = capacity
        this.cache = new Map()
        this.head = new Node(null, null) // Dummy head
        this.tail = new Node(null, null) // Dummy tail
        this.head.next = this.tail
        this.tail.prev = this.head
    }

    /**
     * Retrieves item from cache by key
     * @param {*} key - Key to look up
     * @returns {*} Value if found, null if not found
     */
    get(key) {
        if (this.cache.has(key)) {
            const node = this.cache.get(key)
            this.moveToFront(node)
            return node.value
        } else {
            return null
        }
    }

    /**
     * Adds or updates an item in the cache
     * @param {*} key - Key to store
     * @param {*} value - Value to store
     */
    put(key, value) {
        if (this.cache.has(key)) {
            const node = this.cache.get(key)
            node.value = value
            this.moveToFront(node)
        } else {
            if (this.cache.size >= this.capacity) {
                this.removeLeastUsed()
            }
            const newNode = new Node(key, value)
            this.cache.set(key, newNode)
            this.addToFront(newNode)
        }
    }

    /**
     * Moves a node to front of list (most recently used)
     * @param {Node} node - Node to move
     * @private
     */
    moveToFront(node) {
        this.removeNode(node)
        this.addToFront(node)
    }

    /**
     * Removes a node from the linked list
     * @param {Node} node - Node to remove
     * @private
     */
    removeNode(node) {
        const prev = node.prev
        const next = node.next
        prev.next = next
        next.prev = prev
    }

    /**
     * Adds a node to front of list
     * @param {Node} node - Node to add
     * @private
     */
    addToFront(node) {
        const currentHeadNext = this.head.next
        this.head.next = node
        node.prev = this.head
        node.next = currentHeadNext
        currentHeadNext.prev = node
    }

    /**
     * Removes least recently used item from cache
     * @private
     */
    removeLeastUsed() {
        const node = this.tail.prev
        this.removeNode(node)
        this.cache.delete(node.key)
    }
}