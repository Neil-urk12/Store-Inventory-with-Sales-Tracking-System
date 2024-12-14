<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useQuasar } from "quasar";
import { useContactsStore } from "../stores/contacts";

const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);
const contactsStore = useContactsStore();
const isLoading = ref(true);

onMounted(async () => {
  try {
    console.log("initializing contacts db")
    if (contactsStore.contactCategories.length === 0) {
      await contactsStore.initializeDb();
    }
    console.log("contacts db initialized")
    console.log(contactsStore.contactCategories)
    isLoading.value = false;
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to initialize contacts database',
      position: 'top'
    })
  }
})

const contactEntryModalOpen = ref(false);
const contactEntryModalTitle = ref("");
const contactCategoryModalTitle = ref("");
const showContactCategoryModal = ref(false);
const newContactCategory = reactive({
  id: null,
  name: "",
});

const newContact = reactive({
  id: null,
  categoryId: null,
  name: "",
  email: "",
  phone: "",
  avatar: "https://via.placeholder.com/150",
});

const addContactCategory = () => {
  contactCategoryModalTitle.value = "Add Contact Category";
  newContactCategory.id = null;
  newContactCategory.name = "";
  showContactCategoryModal.value = true;
};

const editContactCategory = (contactCategory) => {
  contactCategoryModalTitle.value = "Edit Contact Category";
  newContactCategory.id = contactCategory.id;
  newContactCategory.name = contactCategory.name;
  showContactCategoryModal.value = true;
};

const deleteContactCategory = (contactCategory) => {
  if (contactCategory.contacts.length > 0) {
    $q.dialog({
      title: 'Delete Contact Category',
      message: `This contact category contains ${contactCategory.contacts.length} contact${contactCategory.contacts.length === 1 ? '' : 's'}. Are you sure you want to delete "${contactCategory.name}" and all its contacts?`,
      ok: {
        label: 'Delete',
        color: 'negative'
      },
      cancel: {
        label: 'Cancel',
        flat: true
      },
      persistent: true
    }).onOk(async () => {
      try {
        await contactsStore.deleteContactCategory(contactCategory.id);
        $q.notify({
          type: 'positive',
          message: 'Contact category deleted successfully',
          position: 'top',
          timeout: 2000
        });
      } catch (error) {
        console.error('Error deleting contact category:', error);
        $q.notify({
          type: 'negative',
          message: 'Error deleting contact category',
          position: 'top',
          timeout: 2000
        });
      }
    });
  } else {
    $q.dialog({
      title: 'Delete Contact Category',
      message: `Delete contact category "${contactCategory.name}"?`,
      ok: {
        label: 'Delete',
        color: 'negative'
      },
      cancel: {
        label: 'Cancel',
        flat: true
      }
    }).onOk(async () => {
      try {
        await contactsStore.deleteContactCategory(contactCategory.id);
        $q.notify({
          type: 'positive',
          message: 'Contact category deleted successfully',
          position: 'top',
          timeout: 2000
        });
      } catch (error) {
        console.error('Error deleting contact category:', error);
        $q.notify({
          type: 'negative',
          message: 'Error deleting contact category',
          position: 'top',
          timeout: 2000
        });
      }
    });
  }
};

const saveContactCategory = async () => {
  try {
    if (newContactCategory.id) {
      await contactsStore.updateContactCategory(newContactCategory.id, {
        name: newContactCategory.name
      });
      $q.notify({
        type: 'positive',
        message: 'Contact category updated successfully',
        position: 'top',
        timeout: 2000
      });
    } else {
      await contactsStore.addContactCategory({
        name: newContactCategory.name
      });
      $q.notify({
        type: 'positive',
        message: 'Contact category added successfully',
        position: 'top',
        timeout: 2000
      });
    }
    showContactCategoryModal.value = false;
  } catch (error) {
    console.error('Error saving contact category:', error);
    $q.notify({
      type: 'negative',
      message: 'Error saving contact category',
      position: 'top',
      timeout: 2000
    });
  }
};

const callContact = (phone) => {
  window.location.href = `tel:${phone}`
};

const emailContact = (email) => {
  window.location.href = `mailto:${email}`
};

const addContact = (contactCategory) => {
  contactEntryModalTitle.value = "Add Contact"
  newContact.id = null
  newContact.categoryId = contactCategory.id.toString()
  newContact.name = ""
  newContact.email = ""
  newContact.phone = ""
  contactEntryModalOpen.value = true
}

const editContact = (contactCategory, contactPerson) => {
  contactEntryModalTitle.value = "Edit Contact";
  newContact.id = contactPerson.id;
  newContact.categoryId = contactCategory.id;
  newContact.name = contactPerson.name;
  newContact.email = contactPerson.email;
  newContact.phone = contactPerson.phone;
  contactEntryModalOpen.value = true;
};

const deleteContact = (contactCategory, contactPerson) => {
  $q.dialog({
    title: 'Delete Contact',
    message: `Delete contact "${contactPerson.name}"?`,
    ok: {
      label: 'Delete',
      color: 'negative'
    },
    cancel: {
      label: 'Cancel',
      flat: true
    }
  }).onOk(async () => {
    try {
      await contactsStore.deleteContact(contactPerson.id);
      $q.notify({
        type: 'positive',
        message: 'Contact deleted successfully',
        position: 'top',
        timeout: 2000
      });
    } catch (error) {
      console.error('Error deleting contact:', error)
      $q.notify({
        type: 'negative',
        message: 'Error deleting contact',
        position: 'top',
        timeout: 2000
      })
    }
  })
}

const saveContact = async () => {
  try {
    const contactData = {
      name: newContact.name.trim(),
      email: newContact.email.trim(),
      phone: newContact.phone.trim(),
      avatar: newContact.avatar,
      categoryId: newContact.categoryId.toString()
    };

    if (newContact.id) {
      await contactsStore.updateContact(newContact.id, contactData)
      $q.notify({
        type: 'positive',
        message: 'Contact updated successfully',
        position: 'top',
        timeout: 2000
      });
    } else {
      await contactsStore.addContact(contactData)
      $q.notify({
        type: 'positive',
        message: 'Contact added successfully',
        position: 'top',
        timeout: 2000
      });
    }
    contactEntryModalOpen.value = false
  } catch (error) {
    console.error('Error saving contact:', error)
    let errorMessage = 'Error saving contact'
    if (error.code === 'VALIDATION_ERROR')
      errorMessage = error.message
    else if (error.code === 'OFFLINE_ERROR')
      errorMessage = 'Cannot save contact while offline'
    else if (error.name === 'DatabaseError')
      errorMessage = error.message

    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      timeout: 2000
    });
  }
};

// Computed property for contact categories from store
const contactCategories = computed(() => contactsStore.contactCategories)
const hasCategories = computed(() => contactCategories.value.length > 0);
</script>

<template>
  <q-page class="q-pa-md">
    <!-- Header Section -->
    <div class="row q-mb-lg items-center justify-between">
      <div class="text-h4 text-weight-bold">Contact Management</div>
      <q-btn
        color="primary"
        icon="add_circle"
        label="ADD CONTACT CATEGORY"
        @click="addContactCategory"
        class="q-px-md"
      />
    </div>

    <!-- Contact Categories Grid -->
    <q-inner-loading :showing="isLoading">
      <q-spinner-gears size="50px" color="primary" />
    </q-inner-loading>

    <div v-if="!isLoading">
      <div v-if="hasCategories" class="row q-col-gutter-md">
        <div v-for="category in contactCategories" 
             :key="`category-${category.id}`" 
             class="col-12 col-sm-6 col-md-4">
          <q-card flat bordered class="category-card">
            <q-card-section class="bg-primary text-white">
              <div class="row items-center justify-between">
                <div class="text-h6">{{ category.name }}</div>
                <div>
                  <q-btn flat round dense icon="edit" @click="editContactCategory(category)" />
                  <q-btn flat round dense icon="delete" @click="deleteContactCategory(category)" />
                </div>
              </div>
            </q-card-section>

            <q-card-section>
              <div class="row q-col-gutter-sm">
                <div v-for="contact in category.contacts" :key="contact.id" class="col-12">
                  <q-item class="contact-item q-pa-sm rounded-borders">
                    <q-item-section avatar role="listitem">
                      <q-avatar>
                        <img :src="contact.avatar" loading="lazy" />
                      </q-avatar>
                    </q-item-section>

                    <q-item-section>
                      <q-item-label class="text-weight-bold" aria-label="Contact Name">{{ contact.name }}</q-item-label>
                      <q-item-label caption>
                        <div class="row items-center">
                          <q-icon name="email" size="xs" class="q-mr-xs" />
                          <span aria-label="Email Address">{{ contact.email }}</span>
                        </div>
                        <div class="row items-center">
                          <q-icon name="phone" size="xs" class="q-mr-xs" />
                          {{ contact.phone }}
                        </div>
                      </q-item-label>
                    </q-item-section>

                    <q-item-section side>
                      <div class="row q-gutter-sm">
                        <q-btn flat round dense color="primary" icon="phone" @click="callContact(contact.phone)" />
                        <q-btn flat round dense color="primary" icon="email" @click="emailContact(contact.email)" />
                        <q-btn flat round dense color="primary" icon="edit" @click="editContact(category, contact)" />
                        <q-btn
                          flat
                          round
                          dense
                          color="negative"
                          icon="delete"
                          @click="deleteContact(category, contact)"
                        />
                      </div>
                    </q-item-section>
                  </q-item>
                </div>
              </div>

              <div class="text-center q-mt-md">
                <q-btn
                  color="primary"
                  outline
                  icon="person_add"
                  label="Add Contact"
                  @click="addContact(category)"
                  class="full-width"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
      <div v-else class="text-center text-grey-7 q-mt-lg">
        No contacts yet. Add a contact category and start adding contacts.
      </div>
    </div>

    <!-- Contact Category Modal -->
    <q-dialog v-model="showContactCategoryModal">
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ contactCategoryModalTitle }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newContactCategory.name"
            label="Category Name"
            filled
            :rules="[val => !!val || 'Category name is required']"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn label="Save" color="primary" @click="saveContactCategory" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Contact Entry Modal -->
    <q-dialog v-model="contactEntryModalOpen">
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ contactEntryModalTitle }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="q-gutter-md">
            <q-input
              v-model="newContact.name"
              label="Name"
              filled
              :rules="[val => !!val?.trim() || 'Name is required']"
            />
            <q-input
              v-model="newContact.email"
              label="Email (Optional)"
              filled
              type="email"
              :rules="[
                val => !val?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || 'Invalid email format'
              ]"
            />
            <q-input
              v-model="newContact.phone"
              label="Phone (Optional)"
              filled
              type="tel"
              :rules="[
                val => !val?.trim() || /^\+?[\d\s-()]+$/.test(val) || 'Invalid phone number format'
              ]"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn label="Save" color="primary" @click="saveContact" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.category-card {
  height: 100%;
  transition: all 0.3s ease;
}
.category-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}
.contact-item {
  transition: all 0.2s ease;
  border: 1px solid transparent;
}
.contact-item:hover {
  background: rgba(0, 0, 0, 0.03);
  border-color: var(--q-primary);
}
.dark .contact-item:hover {background: rgba(255, 255, 255, 0.1)}
.dark .category-card:hover {box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3)}
</style>
