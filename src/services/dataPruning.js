/**
 * @fileoverview Service for managing local data storage limits and pruning
 */

import { db } from '../db/dexiedb'

const MAX_OFFLINE_DAYS = 30
const MAX_STORAGE_SIZE_MB = 50

export class DataPruningService {
  static async pruneOldData() {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - MAX_OFFLINE_DAYS)

    await db.transaction('rw', [db.sales, db.inventory], async () => {
      // Prune old sales data
      try {
        await db.sales
          .where('date')
          .below(cutoffDate)
          .and(item => item.syncStatus === 'synced')
          .delete()

        // Prune old inventory history
        await db.inventory
          .where('lastModified')
          .below(cutoffDate)
          .and(item => item.syncStatus === 'synced')
          .delete()
      } catch (error) {
        if (error.name === 'ConstraintError') {
          await db.sales.where('syncStatus').equals('pending').modify({syncStatus: 'error'});
          await db.inventory.where('syncStatus').equals('pending').modify({syncStatus: 'error'});
        }
        console.error('Error pruning old data: ', error)
        throw error
      }
    })
  }

  static async checkStorageQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      const usedMB = estimate.usage / (1024 * 1024)
      if (usedMB > MAX_STORAGE_SIZE_MB) {
        await this.pruneOldData()
      }
    }
  }

  static startAutoPrune() {
    // Check storage usage daily
    setInterval(() => {
      this.checkStorageQuota()
    }, 24 * 60 * 60 * 1000)
  }
}
