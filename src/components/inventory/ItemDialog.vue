<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useQuasar } from 'quasar'
import { computed, ref, watch } from 'vue'
import { useNetworkStatus } from 'src/services/networkStatus'

const inventoryStore = useInventoryStore()
const $q = useQuasar()
const { isOnline } = useNetworkStatus()
const editedItem = computed(() => inventoryStore.editedItem)
const loading = computed(() => inventoryStore.loading)
const editMode = computed(() => inventoryStore.editMode)
const formRef = ref(null)
const imageLoading = ref(false)
const imageError = ref(false)

// Image preview handling
const imagePreviewUrl = ref('')
const checkImage = async (url) => {
  if (!url) {
    imagePreviewUrl.value = ''
    imageError.value = false
    return
  }

  imageLoading.value = true
  imageError.value = false

  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
      imagePreviewUrl.value = url
      imageError.value = false
    } else {
      imageError.value = true
      imagePreviewUrl.value = ''
    }
  } catch (err) {
    imageError.value = true
    imagePreviewUrl.value = ''
  } finally {
    imageLoading.value = false
  }
}

// Watch for image URL changes
watch(() => editedItem.value.image, (newUrl) => {
  if (newUrl)
    checkImage(newUrl)
  else {
    imagePreviewUrl.value = ''
    imageError.value = false
  }
})

const validateAndSave = async () => {
  if (!formRef.value) return

  try {
    const isValid = await formRef.value.validate()
    if (!isValid) return

    const result = editMode.value
      ? await inventoryStore.updateExistingItem(editedItem.value.id, editedItem.value)
      : await inventoryStore.createNewItem(editedItem.value)

    const action = editMode.value ? 'updated' : 'added'
    if (result.offline)
      $q.notify({
        color: 'warning',
        message: `Item will be ${action} when back online`,
        caption: 'Changes saved locally',
        icon: 'cloud_off',
        position: 'top',
        timeout: 3000
      })
    else
      $q.notify({
        color: 'positive',
        message: `Item ${action} successfully`,
        icon: 'cloud_done',
        position: 'top'
      })

    // Close dialog and reset form
    inventoryStore.itemDialog = false
    // formRef.value.resetValidation()
    await inventoryStore.loadInventory() // Refresh the inventory list
  } catch (err) {
    console.error('Save error:', err)
    $q.notify({
      color: 'negative',
      message: `Failed to ${editMode.value ? 'update' : 'add'} item`,
      caption: err.message,
      icon: 'error',
      position: 'top'
    })
  }
}
</script>

<template>
  <q-dialog v-model="inventoryStore.itemDialog" persistent>
    <q-card style="min-width: 350px">
      <q-card-section class="row items-center">
        <div class="text-h6">{{ editMode ? 'Edit Item' : 'Add New Item' }}</div>
        <q-space />
        <q-chip
          v-if="!isOnline"
          dense
          color="warning"
          text-color="white"
          icon="cloud_off"
        >
          Offline Mode
        </q-chip>
      </q-card-section>

      <q-card-section>
        <q-form
          ref="formRef"
          @submit.prevent="validateAndSave"
          class="q-gutter-md"
          greedy
        >
          <q-input
            v-model="editedItem.name"
            label="Name"
            :rules="[
              val => !!val || 'Name is required',
              val => val.length <= 100 || 'Name must be 100 characters or less'
            ]"
            dense
            outlined
          />

          <q-input
            v-model="editedItem.sku"
            label="SKU"
            :rules="[
              val => !!val || 'SKU is required',
              val => /^[A-Za-z0-9-]+$/.test(val) || 'SKU must contain only letters, numbers, and hyphens'
            ]"
            dense
            outlined
          />

          <q-select
            v-model="editedItem.categoryId"
            :options="inventoryStore.formattedCategories"
            label="Category"
            :rules="[val => !!val || 'Category is required']"
            dense
            outlined
            emit-value
            map-options
          />

          <q-input
            v-model.number="editedItem.quantity"
            label="Quantity"
            type="number"
            :rules="[
              val => val >= 0 || 'Quantity cannot be negative',
              val => Number.isInteger(val) || 'Quantity must be a whole number',
              val => !!val || 'Quantity is required'
            ]"
            dense
            outlined
          />

          <q-input
            v-model.number="editedItem.price"
            label="Price"
            type="number"
            :rules="[
              val => val >= 0 || 'Price cannot be negative',
              val => !!val || 'Price is required',
              val => val <= 1000000 || 'Price cannot exceed 1,000,000'
            ]"
            dense
            outlined
            prefix="₱"
          />

          <div class="column q-gutter-y-sm">
            <q-input
              v-model="editedItem.image"
              label="Image URL (Optional)"
              :rules="[
                val => !val || /^https?:\/\/.+/.test(val) || 'Must be a valid URL starting with http:// or https://'
              ]"
              hint="Leave empty for no image"
              dense
              outlined
              :loading="imageLoading"
              :error="imageError"
              :error-message="imageError ? 'Unable to load image from URL' : ''"
            >
              <template v-slot:append>
                <q-icon
                  v-if="editedItem.image"
                  name="clear"
                  class="cursor-pointer"
                  @click="editedItem.image = ''"
                />
              </template>
            </q-input>

            <div v-if="imagePreviewUrl" class="image-preview q-mt-md flex justify-center items-center">
              <q-img
                :src="imagePreviewUrl"
                style="max-width: 200px; max-height: 200px"
                fit="contain"
                loading="lazy"
                @error="imageError = true"
              >
                <template v-slot:loading>
                  <q-spinner-dots color="white" />
                </template>
                <template v-slot:error>
                  <div class="absolute-full flex flex-center bg-negative text-white">
                    Cannot load image
                  </div>
                </template>
              </q-img>
            </div>
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          label="Cancel"
          color="primary"
          v-close-popup
          :disable="loading"
        />
        <q-btn
          flat
          :label="isOnline ? 'Save' : 'Save Offline'"
          :color="isOnline ? 'primary' : 'warning'"
          type="submit"
          @click="validateAndSave"
          :loading="loading"
        >
          <template v-slot:loading>
            <q-spinner-dots />
          </template>
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.image-preview {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
}
</style>
