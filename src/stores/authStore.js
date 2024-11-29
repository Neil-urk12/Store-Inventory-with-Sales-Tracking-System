/**
 * @fileoverview Manages authentication state and operations.
 * Implements Pinia store pattern for authentication management.
 */

import { defineStore } from 'pinia'
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth'
import { collection, getDocs, query, where, limit } from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'
import { auth } from '../firebase/firebaseconfig'

/**
 * @const {Store} useAuthStore
 * @description Pinia store for managing authentication state and operations
 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    isAuthenticated: localStorage.getItem('isAuthenticated') === 'true',
    loading: false,
    error: null
  }),

  getters: {
    /**
     * @getter
     * @returns {Object|null} Current user object
     */
    getUser: (state) => state.user,
    getIsAuthenticated: (state) => state.isAuthenticated,
    getLoading: (state) => state.loading,
    getError: (state) => state.error
  },

  actions: {
    /**
     * @async
     * @method loginWithEmail
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {boolean} [rememberMe=false] - Whether to persist authentication
     * @returns {Promise<boolean>} Success status
     * @throws {Error} If login fails
     */
    async loginWithEmail(email, password, rememberMe = false) {
      if (!email || !password) throw new Error('Email and password are required')

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) throw new Error('Invalid email format')

      this.loading = true
      this.error = null

      try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        this.user = userCredential.user
        this.isAuthenticated = true
        localStorage.setItem('isAuthenticated', true)
        return true
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @method loginWithPasskey
     * @param {string} key - Passkey for authentication
     * @param {boolean} [rememberMe=false] - Whether to persist authentication
     * @returns {Promise<boolean>} Success status
     * @throws {Error} If login fails
     */
    async loginWithPasskey(key, rememberMe = false) {
      if (!key) throw new Error('Passkey is required')
      if (key.length < 6) throw new Error('Passkey must be at least 6 characters')

      this.loading = true
      this.error = null

      try {
        const db = getFirestore()
        const passkeysRef = collection(db, 'passkeys')
        const q = query(
          passkeysRef,
          where('key', '==', key),
          where('active', '==', true),
          limit(1)
        )

        const snapshot = await getDocs(q)
        if (snapshot.empty) throw new Error('Invalid passkey')

        const passkey = snapshot.docs[0].data()
        if (passkey.expiresAt && passkey.expiresAt.toDate() < new Date()) {
          throw new Error('Passkey has expired')
        }

        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
        this.isAuthenticated = true
        this.user = {
          email: 'admin@example.com',
          role: 'admin',
          displayName: 'Administrator',
          id: 'admin-user'
        }
        localStorage.setItem('isAuthenticated', true)
        return true
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @method logout
     * @returns {Promise<void>}
     * @description Logs out the current user and clears authentication state
     */
    async logout() {
      this.loading = true
      try {
        await signOut(auth)
        this.user = null
        this.isAuthenticated = false
        localStorage.removeItem('isAuthenticated')
        return true
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @method resetPassword
     * @param {string} email - User email
     * @returns {Promise<void>}
     * @description Sends a password reset email to the user
     */
    async resetPassword(email) {
      if (!email) throw new Error('Email is required')
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) throw new Error('Invalid email format')

      this.loading = true
      this.error = null

      try {
        await sendPasswordResetEmail(auth, email)
        return true
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * @method initializeAuthListener
     * @description Initializes the authentication state listener
     */
    initializeAuthListener() {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          this.user = user
          this.isAuthenticated = true
          localStorage.setItem('isAuthenticated', true)
        } else {
          this.user = null
          this.isAuthenticated = false
          localStorage.removeItem('isAuthenticated')
        }
      })
    }
  }
})
