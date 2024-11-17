<script setup>
import { ref, reactive, computed } from "vue";
import { useQuasar } from "quasar";
import { useContactsStore } from "../stores/contacts";

const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);
const contactsStore = useContactsStore();

// Initialize the database with mock data
contactsStore.initializeDb();

const showCategoryModal = ref(false);
const categoryModalTitle = ref("");
const newCategory = reactive({
  id: null,
  name: "",
});

const addCategory = () => {
  categoryModalTitle.value = "Add Category";
  newCategory.id = null;
  newCategory.name = "";
  showCategoryModal.value = true;
};

const editCategory = (category) => {
  categoryModalTitle.value = "Edit Category";
  newCategory.id = category.id;
  newCategory.name = category.name;
  showCategoryModal.value = true;
};

const deleteCategory = (category) => {
  if (category.contacts.length > 0) {
    $q.dialog({
      title: 'Delete Category',
      message: `This category contains ${category.contacts.length} contact${category.contacts.length === 1 ? '' : 's'}. Are you sure you want to delete "${category.name}" and all its contacts?`,
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
        await contactsStore.deleteCategory(category.id);
        $q.notify({
          type: 'positive',
          message: 'Category deleted successfully',
          position: 'top',
          timeout: 2000
        });
      } catch (error) {
        console.error('Error deleting category:', error);
        $q.notify({
          type: 'negative',
          message: 'Error deleting category',
          position: 'top',
          timeout: 2000
        });
      }
    });
  } else {
    $q.dialog({
      title: 'Delete Category',
      message: `Delete category "${category.name}"?`,
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
        await contactsStore.deleteCategory(category.id);
        $q.notify({
          type: 'positive',
          message: 'Category deleted successfully',
          position: 'top',
          timeout: 2000
        });
      } catch (error) {
        console.error('Error deleting category:', error);
        $q.notify({
          type: 'negative',
          message: 'Error deleting category',
          position: 'top',
          timeout: 2000
        });
      }
    });
  }
};

const saveCategory = async () => {
  try {
    if (!newCategory.name.trim()) {
      $q.notify({
        type: 'negative',
        message: 'Category name is required',
        position: 'top',
        timeout: 2000
      });
      return;
    }

    if (newCategory.id === null) {
      await contactsStore.addCategory({ name: newCategory.name });
      $q.notify({
        type: 'positive',
        message: 'Category added successfully',
        position: 'top',
        timeout: 2000
      });
    } else {
      await contactsStore.updateCategory(newCategory.id, { name: newCategory.name });
      $q.notify({
        type: 'positive',
        message: 'Category updated successfully',
        position: 'top',
        timeout: 2000
      });
    }
    closeCategoryModal();
  } catch (error) {
    console.error('Error saving category:', error);
    $q.notify({
      type: 'negative',
      message: 'Error saving category',
      position: 'top',
      timeout: 2000
    });
  }
};

const showModal = ref(false);
const modalTitle = ref("");
const newContact = reactive({
  id: null,
  categoryId: null,
  name: "",
  email: "",
  phone: "",
  avatar: "https://via.placeholder.com/150",
});

const callContact = (phone) => {
  window.location.href = `tel:${phone}`;
};

const emailContact = (email) => {
  window.location.href = `mailto:${email}`;
};

const addContact = (category) => {
  modalTitle.value = "Add Contact";
  newContact.id = null;
  newContact.categoryId = category.id;
  newContact.name = "";
  newContact.email = "";
  newContact.phone = "";
  showModal.value = true;
};

const editContact = (category, contact) => {
  modalTitle.value = "Edit Contact";
  newContact.id = contact.id;
  newContact.categoryId = category.id;
  newContact.name = contact.name;
  newContact.email = contact.email;
  newContact.phone = contact.phone;
  showModal.value = true;
};

const deleteContact = (category, contact) => {
  $q.dialog({
    title: 'Delete Contact',
    message: `Delete contact "${contact.name}"?`,
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
      await contactsStore.deleteContact(contact.id);
      $q.notify({
        type: 'positive',
        message: 'Contact deleted successfully',
        position: 'top',
        timeout: 2000
      });
    } catch (error) {
      console.error('Error deleting contact:', error);
      $q.notify({
        type: 'negative',
        message: 'Error deleting contact',
        position: 'top',
        timeout: 2000
      });
    }
  });
};

const saveContact = async () => {
  try {
    if (!newContact.name.trim()) {
      $q.notify({
        type: 'negative',
        message: 'Contact name is required',
        position: 'top',
        timeout: 2000
      });
      return;
    }

    const contactData = {
      name: newContact.name,
      email: newContact.email,
      phone: newContact.phone,
      avatar: newContact.avatar,
      categoryId: newContact.categoryId
    };

    if (newContact.id === null) {
      await contactsStore.addContact(contactData);
      $q.notify({
        type: 'positive',
        message: 'Contact added successfully',
        position: 'top',
        timeout: 2000
      });
    } else {
      await contactsStore.updateContact(newContact.id, contactData);
      $q.notify({
        type: 'positive',
        message: 'Contact updated successfully',
        position: 'top',
        timeout: 2000
      });
    }
    closeModal();
  } catch (error) {
    console.error('Error saving contact:', error);
    $q.notify({
      type: 'negative',
      message: 'Error saving contact',
      position: 'top',
      timeout: 2000
    });
  }
};

const closeModal = () => {
  showModal.value = false;
};

const closeCategoryModal = () => {
  showCategoryModal.value = false;
};

// Remove after full implementation of database
// Function to repopulate the database for testing
const repopulateDatabase = async () => {
  try {
    $q.dialog({
      title: 'Repopulate Database',
      message: 'This will clear all existing data and repopulate with mock data. Are you sure?',
      ok: {
        label: 'Yes, Repopulate',
        color: 'primary'
      },
      cancel: {
        label: 'Cancel',
        flat: true
      },
      persistent: true
    }).onOk(async () => {
      try {
        await contactsStore.repopulateDatabase();
        $q.notify({
          type: 'positive',
          message: 'Database repopulated successfully'
        });
      } catch (error) {
        $q.notify({
          type: 'negative',
          message: 'Error repopulating database: ' + error.message
        });
      }
    });
  } catch (error) {
    console.error('Error in repopulateDatabase:', error);
  }
};

// Computed property for categories from store
const categories = computed(() => contactsStore.categories);
</script>

<template>
  <q-page class="q-pa-xs">
    <div class="row q-mb-md items-center justify-between">
      <div class="text-h5">Contacts</div>
      <div>
        <q-btn
          color="primary"
          icon="add"
          label="Add Category"
          @click="addCategory"
          class="q-mr-sm"
        />
        <q-btn
          color="secondary"
          icon="refresh"
          label="Repopulate Database"
          @click="repopulateDatabase"
        />
      </div>
    </div>
    <q-list>
      <q-expansion-item
        class="category-header bg-transparent q-mb-sm"
        v-for="category in categories"
        :key="category.id"
        dense
        :dark="isDark"
        expand-icon-class="text-primary"
      >
        <template v-slot:header>
          <div class="row items-center full-width">
            <div class="text-h6 text-weight-medium">{{ category.name }}</div>
            <q-space />
            <q-btn
              icon="edit"
              color="primary"
              flat
              round
              dense
              @click.stop="editCategory(category)"
            >
              <q-tooltip>Edit Category</q-tooltip>
            </q-btn>
            <q-btn
              icon="delete"
              color="negative"
              flat
              round
              dense
              @click.stop="deleteCategory(category)"
            >
              <q-tooltip>Delete Category</q-tooltip>
            </q-btn>
          </div>
        </template>
        <q-list>
          <q-item
            v-for="contact in category.contacts"
            :key="contact.id"
            class="q-mb-md contact-card"
          >
            <q-item-section avatar>
              <q-avatar>
                <img :src="contact.avatar" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ contact.name }}</q-item-label>
              <q-item-label caption>{{ contact.email }}</q-item-label>
              <q-item-label caption>{{ contact.phone }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                icon="phone"
                color="primary"
                flat
                round
                @click="callContact(contact.phone)"
              />
              <q-btn
                icon="email"
                color="primary"
                flat
                round
                @click="emailContact(contact.email)"
              />
              <q-btn
                icon="edit"
                color="accent"
                flat
                round
                @click="editContact(category, contact)"
              />
              <q-btn
                icon="delete"
                color="negative"
                flat
                round
                @click="deleteContact(category, contact)"
              />
            </q-item-section>
          </q-item>
          <q-separator />
          <q-item>
            <q-item-section>
              <q-btn color="primary" @click="addContact(category)">
                Add Contact
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </q-list>
    <q-dialog v-model="showCategoryModal">
      <q-card style="width: 300px">
        <q-card-section>
          <div class="text-h6">{{ categoryModalTitle }}</div>
        </q-card-section>
        <q-card-section>
          <q-form @submit="saveCategory">
            <q-input
              v-model="newCategory.name"
              label="Category Name"
              required
            />
            <div class="row justify-end q-mt-md">
              <q-btn color="primary" type="submit">Save</q-btn>
              <q-btn color="negative" flat @click="closeCategoryModal"
                >Cancel</q-btn
              >
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog v-model="showModal">
      <q-card style="width: 300px">
        <q-card-section>
          <div class="text-h6">{{ modalTitle }}</div>
        </q-card-section>
        <q-card-section>
          <q-form @submit="saveContact">
            <q-input v-model="newContact.name" label="Name" required />
            <q-input v-model="newContact.email" label="Email" type="email" />
            <q-input
              v-model="newContact.phone"
              label="Phone"
              type="tel"
              required
            />
            <q-input
              v-model="newContact.avatar"
              label="Avatar URL"
              type="url"
            />
            <div class="row justify-end q-mt-md">
              <q-btn color="primary" type="submit"> Save </q-btn>
              <q-btn color="negative" flat @click="closeModal"> Cancel </q-btn>
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.category-header {
  font-size: 1.2rem;
  padding: 16px;
}
.contact-card {
  margin: 12px 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}
.contact-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}
.q-expansion-item :deep(.q-expansion-item__toggle-icon) {
  margin-right: 8px;
}
.q-expansion-item :deep(.q-item__section--right) {
  margin-left: auto;
}
.q-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
  overflow: auto;
}

.q-item .q-item__section--avatar {
  margin-right: 16px;
}
.q-item .q-item__section--side {
  flex-grow: 1;
  display: flex;
  align-items: center;
  display: flex;
  align-items: center;
}
.q-item .q-btn {
  margin-left: 8px;
}
.q-expansion-item__container {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 16px;
}
.q-expansion-item__content {
  padding: 16px;
  background: #f9f9f9;
}
</style>
