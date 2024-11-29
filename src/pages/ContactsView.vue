<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useQuasar } from "quasar";
import { useContactsStore } from "../stores/contacts";

const $q = useQuasar();
const isDark = computed(() => $q.dark.isActive);
const contactsStore = useContactsStore();

onMounted(async () => {
  try {
    await contactsStore.initializeDb();
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
  window.location.href = `tel:${phone}`;
};

const emailContact = (email) => {
  window.location.href = `mailto:${email}`;
};

const addContact = (contactCategory) => {
  contactEntryModalTitle.value = "Add Contact";
  newContact.id = null;
  newContact.categoryId = contactCategory.id;
  newContact.name = "";
  newContact.email = "";
  newContact.phone = "";
  contactEntryModalOpen.value = true;
};

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

    if (newContact.id) {
      await contactsStore.updateContact(newContact.id, contactData);
      $q.notify({
        type: 'positive',
        message: 'Contact updated successfully',
        position: 'top',
        timeout: 2000
      });
    } else {
      await contactsStore.addContact(contactData);
      $q.notify({
        type: 'positive',
        message: 'Contact added successfully',
        position: 'top',
        timeout: 2000
      });
    }
    contactEntryModalOpen.value = false;
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

// Computed property for contact categories from store
const contactCategories = computed(() => contactsStore.contactCategories);
</script>

<template>
  <q-page class="q-pa-xs">
    <div class="row q-mb-md items-center justify-between">
      <div class="text-h5">Contact Management</div>
      <div>
        <q-btn
          color="primary"
          icon="add"
          label="Add Contact Category"
          @click="addContactCategory"
          class="q-mr-sm"
        />
      </div>
    </div>
    <q-list>
      <q-expansion-item
        class="contact-category-header bg-transparent q-mb-sm"
        v-for="contactCategory in contactCategories"
        :key="contactCategory.id"
        dense
        :dark="isDark"
        group="contact-categories"
        icon="folder"
        :label="contactCategory.name"
      >
        <template v-slot:header-right>
          <div class="row items-center">
            <q-btn
              icon="edit"
              color="primary"
              flat
              round
              dense
              @click.stop="editContactCategory(contactCategory)"
            >
              <q-tooltip>Edit Contact Category</q-tooltip>
            </q-btn>
            <q-btn
              icon="delete"
              color="negative"
              flat
              round
              dense
              @click.stop="deleteContactCategory(contactCategory)"
            >
              <q-tooltip>Delete Contact Category</q-tooltip>
            </q-btn>
          </div>
        </template>
        <q-list>
          <q-item
            v-for="contactPerson in contactCategory.contacts"
            :key="contactPerson.id"
            class="q-mb-md contact-card"
          >
            <q-item-section avatar>
              <q-avatar>
                <img :src="contactPerson.avatar" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ contactPerson.name }}</q-item-label>
              <q-item-label caption>{{ contactPerson.email }}</q-item-label>
              <q-item-label caption>{{ contactPerson.phone }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                icon="phone"
                color="primary"
                flat
                round
                @click="callContact(contactPerson.phone)"
              />
              <q-btn
                icon="email"
                color="primary"
                flat
                round
                @click="emailContact(contactPerson.email)"
              />
              <q-btn
                icon="edit"
                color="accent"
                flat
                round
                @click="editContact(contactCategory, contactPerson)"
              />
              <q-btn
                icon="delete"
                color="negative"
                flat
                round
                @click="deleteContact(contactCategory, contactPerson)"
              />
            </q-item-section>
          </q-item>
          <q-separator />
          <q-item>
            <q-item-section>
              <q-btn color="primary" @click="addContact(contactCategory)">
                Add Contact
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </q-list>
    <q-dialog v-model="showContactCategoryModal">
      <q-card style="width: 300px">
        <q-card-section>
          <div class="text-h6">{{ contactCategoryModalTitle }}</div>
        </q-card-section>
        <q-card-section>
          <q-form @submit="saveContactCategory">
            <q-input
              v-model="newContactCategory.name"
              label="Contact Category Name"
              required
            />
            <div class="row justify-end q-mt-md">
              <q-btn color="primary" type="submit">Save</q-btn>
              <q-btn color="negative" flat @click="showContactCategoryModal = false"
                >Cancel</q-btn
              >
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog v-model="contactEntryModalOpen">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">{{ contactEntryModalTitle }}</div>
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
              <q-btn color="negative" flat @click="contactEntryModalOpen = false"
                >Cancel</q-btn
              >
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.contact-category-header {
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
