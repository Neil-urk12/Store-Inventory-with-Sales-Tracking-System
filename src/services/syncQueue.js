import { db } from '../db/dexiedb'
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'

class SyncQueue {
  constructor() {
    this.queue = []
    this.isProcessing = false
  }

  async addToQueue(operation) {
    await db.syncQueue.add(operation)
  }

  async processQueue() {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      const operations = await db.syncQueue.toArray()
      
      for (const operation of operations) {
        try {
          await this.processOperation(operation)
          await db.syncQueue.delete(operation.id)
        } catch (error) {
          console.error('Error processing operation:', operation, error)
          // Keep failed operations in queue for retry
        }
      }
    } catch (error) {
      console.error('Error processing sync queue:', error)
    } finally {
      this.isProcessing = false
    }
  }

  async processOperation(operation) {
    const { type, collection: collectionName, data, docId } = operation

    switch (type) {
      case 'add':
        await addDoc(collection(fireDb, collectionName), data)
        break
      case 'update':
        await updateDoc(doc(fireDb, collectionName, docId), data)
        break
      case 'delete':
        await deleteDoc(doc(fireDb, collectionName, docId))
        break
      default:
        throw new Error(`Unknown operation type: ${type}`)
    }
  }
}

export const syncQueue = new SyncQueue()
