<script lang="ts" setup>
import type { RadioGroupItem } from '#ui/components/RadioGroup.vue';
import type { SelectItem } from '#ui/components/Select.vue';
import type { SelectMenuItem } from '#ui/components/SelectMenu.vue';
// ============================================================================
// Imports
// ============================================================================
import type { InferOutput } from 'valibot';

import { LazyModalBase } from '#components';
import * as v from 'valibot';

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const colorMode = useColorMode();
const overlay = useOverlay();

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  middleware: () => {
    const config = useRuntimeConfig();
    if (config.public.appEnv === 'production') {
      return navigateTo('/');
    }
  },
});

// ============================================================================
// Variables
// ============================================================================
const modal = overlay.create(LazyModalBase);

const componentExamples: Array<{
  code: string;
  description: string;
  title: string;
}> = [
  {
    code: '<UButton color="primary" size="md">Click me</UButton>',
    description: 'Interactive buttons with multiple variants, sizes, and states.',
    title: 'Buttons',
  },
  {
    code: '<UAlert title="Info" description="This is an alert" />',
    description: 'Contextual alerts with customizable colors and icons.',
    title: 'Alerts',
  },
  {
    code: '<UCard><template #header>Title</template>Content</UCard>',
    description: 'Flexible cards with header, body, and footer slots.',
    title: 'Cards',
  },
];

// Form Schema and State
const formSchema = v.object({
  acceptTerms: v.boolean([v.toMinValue(true, 'You must accept the terms and conditions')]),
  age: v.pipe(v.number([v.minValue(18, 'You must be at least 18 years old'), v.maxValue(120, 'Please enter a valid age')]), v.integer()),
  bio: v.optional(v.pipe(v.string(), v.maxLength(500, 'Bio must not exceed 500 characters'))),
  country: v.pipe(v.string(), v.minLength(1, 'Please select a country')),
  email: v.pipe(v.string(), v.email('Please enter a valid email address')),
  image: v.optional(v.custom<File>(
    (value) => value instanceof File && ['image/gif', 'image/jpeg', 'image/png'].includes(value.type) && value.size <= 2 * 1024 * 1024,
    'Bitte lade eine Bilddatei (JPG, PNG, GIF) mit max. 2MB hoch',
  )),
  interests: v.pipe(v.array(v.string()), v.minLength(1, 'Please select at least one interest')),
  name: v.pipe(v.string(), v.minLength(2, 'Name must be at least 2 characters'), v.maxLength(50, 'Name must not exceed 50 characters')),
  newsletter: v.boolean(),
  password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
  preferredContact: v.pipe(v.string(), v.minLength(1, 'Please select a preferred contact method')),
  salary: v.pipe(v.number(), v.minValue(0, 'Salary must be positive'), v.integer()),
});

type FormSchema = InferOutput<typeof formSchema>;

const formState = reactive<FormSchema>({
  acceptTerms: false,
  age: 25,
  bio: '',
  country: 'de',
  email: '',
  image: undefined,
  interests: [],
  name: '',
  newsletter: false,
  password: '',
  preferredContact: '',
  salary: 50000,
});

const countryOptions = ref<SelectItem[]>([
  {
    label: 'Deutschland',
    value: 'de',
  },
  {
    label: 'England',
    value: 'en',
  },
  {
    label: 'Spanien',
    value: 'es',
  },
  {
    label: 'Italien',
    value: 'it',
  },
]);

const interestOptions = ref<SelectMenuItem[]>([
  {
    label: 'Frontend Development',
    value: 'frontend',
  },
  {
    label: 'Backend Development',
    value: 'backend',
  },
  {
    label: 'DevOps',
    value: 'devops',
  },
  {
    label: 'UI/UX Design',
    value: 'design',
  },
  {
    label: 'Mobile Development',
    value: 'mobile',
  },
]);

const contactMethodOptions = ref<RadioGroupItem[]>([
  {
    description: 'Email as option.',
    label: 'Email',
    value: 'email',
  },
  {
    description: 'Phone as option.',
    label: 'Phone',
    value: 'phone',
  },
  {
    description: 'SMS as option.',
    label: 'SMS',
    value: 'sms',
  },
  {
    description: 'Pigeon as option.',
    label: 'Pigeon',
    value: 'pigeon',
  },
]);

// ============================================================================
// Functions
// ============================================================================
async function handleFormSubmit(): Promise<void> {
  toast.add({
    color: 'success',
    description: 'All form fields are valid! Check the browser console for the submitted data.',
    title: 'Form Submitted',
  });

  console.info('Form Data:', formState);
}

async function openModal(): Promise<void> {
  const instance = modal.open({
    description: 'This demonstrates the useOverlay composable for programmatic modal control.',
    title: 'Programmatic Modal',
  });

  const result = await instance.result;

  if (result) {
    toast.add({
      color: 'success',
      description: 'You confirmed the modal action.',
      title: 'Confirmed',
    });
  } else {
    toast.add({
      color: 'neutral',
      description: 'Modal was dismissed.',
      title: 'Dismissed',
    });
  }
}

function showToast(type: 'error' | 'info' | 'success' | 'warning'): void {
  const messages: Record<string, { description: string; title: string }> = {
    error: { description: 'Something went wrong.', title: 'Error' },
    info: { description: 'Here is some information.', title: 'Info' },
    success: { description: 'Your action was successful!', title: 'Success' },
    warning: { description: 'Please be careful.', title: 'Warning' },
  };

  toast.add({
    color: type,
    description: messages[type].description,
    title: messages[type].title,
  });
}

function toggleColorMode(): void {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-neutral-950">
    <div class="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <!-- Header -->
      <div class="mb-12">
        <div class="flex items-center justify-between mb-4">
          <div>
            <UBadge color="warning" variant="subtle" size="lg" class="mb-4"> Development Only </UBadge>
            <h1 class="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-5xl">Interactive Examples</h1>
            <p class="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
              Diese Seite ist nur im Development-Modus verfügbar und zeigt alle interaktiven Beispiele des Templates.
            </p>
          </div>
          <UButton to="/" icon="i-lucide-arrow-left" variant="outline" color="neutral" size="lg"> Zurück zur Startseite </UButton>
        </div>
      </div>

      <!-- Components Demo Section -->
      <div class="mb-16">
        <h2 class="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-8">Nuxt UI Components</h2>
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-3 mb-12">
          <UCard v-for="example in componentExamples" :key="example.title" variant="outline">
            <template #header>
              <h3 class="font-semibold text-neutral-900 dark:text-white">
                {{ example.title }}
              </h3>
            </template>
            <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {{ example.description }}
            </p>
            <div class="bg-neutral-100 dark:bg-neutral-900 rounded-lg p-3 mt-4">
              <code class="text-xs text-neutral-800 dark:text-neutral-300 break-all">
                {{ example.code }}
              </code>
            </div>
          </UCard>
        </div>
      </div>

      <!-- Interactive Examples -->
      <div class="space-y-8">
        <UAlert
          title="Hinweis"
          description="Diese Beispiele demonstrieren die wichtigsten UI-Komponenten und Composables des Templates. Perfekt zum Testen und als Referenz für neue Projekte."
          icon="i-lucide-lightbulb"
          color="primary"
          variant="subtle"
        />

        <UCard variant="outline">
          <template #header>
            <h3 class="text-xl font-semibold text-neutral-900 dark:text-white">Interaktive Komponenten</h3>
          </template>

          <div class="space-y-6">
            <!-- Toast Notifications -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Toast Notifications</h4>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                Verwende <code class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">useToast()</code> für Benachrichtigungen.
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton color="success" size="sm" @click="showToast('success')"> Success </UButton>
                <UButton color="error" size="sm" @click="showToast('error')"> Error </UButton>
                <UButton color="info" size="sm" @click="showToast('info')"> Info </UButton>
                <UButton color="warning" size="sm" @click="showToast('warning')"> Warning </UButton>
              </div>
            </div>

            <USeparator />

            <!-- Color Mode Toggle -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Color Mode</h4>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                Verwende <code class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">useColorMode()</code> für Dark/Light Mode.
              </p>
              <div class="flex items-center gap-4">
                <UButton :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" color="neutral" variant="outline" size="sm" @click="toggleColorMode">
                  Toggle {{ colorMode.value === 'dark' ? 'Light' : 'Dark' }} Mode
                </UButton>
                <UBadge :color="colorMode.value === 'dark' ? 'primary' : 'warning'" size="md"> Current: {{ colorMode.value }} </UBadge>
              </div>
            </div>

            <USeparator />

            <!-- Badges -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Badges & Variants</h4>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">Verschiedene Badge-Varianten und Farben für unterschiedliche Zwecke.</p>
              <div class="flex flex-wrap gap-2">
                <UBadge color="primary" variant="solid"> Primary </UBadge>
                <UBadge color="secondary" variant="solid"> Secondary </UBadge>
                <UBadge color="success" variant="outline"> Success </UBadge>
                <UBadge color="error" variant="soft"> Error </UBadge>
                <UBadge color="info" variant="subtle" icon="i-lucide-info"> Info </UBadge>
              </div>
            </div>

            <USeparator />

            <!-- Modal -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Programmatic Modal</h4>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                Verwende das <code class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">useOverlay()</code> Composable um Modals programmatisch zu öffnen und
                auf das Ergebnis zu warten.
              </p>
              <UButton icon="i-lucide-square-dashed-mouse-pointer" color="primary" size="sm" variant="outline" @click="openModal"> Open Modal </UButton>
            </div>
          </div>
        </UCard>

        <!-- Form Example with Valibot -->
        <UCard variant="outline">
          <template #header>
            <h3 class="text-xl font-semibold text-neutral-900 dark:text-white">Form Validation mit Valibot</h3>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Dieses Formular demonstriert alle wichtigen Nuxt UI Input-Komponenten mit Valibot-Validierung. Fülle alle Pflichtfelder aus und beobachte die Echtzeit-Validierung.
            </p>

            <UForm :state="formState" :schema="formSchema" class="space-y-6 grid md:grid-cols-2 gap-4" @submit="handleFormSubmit">
              <!-- Text Input -->
              <UFormField label="Full Name" name="name" required>
                <UInput v-model="formState.name" placeholder="Enter your full name" icon="i-lucide-user" class="w-full" />
              </UFormField>

              <!-- Email Input -->
              <UFormField label="Email Address" name="email" required>
                <UInput v-model="formState.email" type="email" placeholder="your.email@example.com" icon="i-lucide-mail" class="w-full" />
              </UFormField>

              <!-- Password Input -->
              <UFormField label="Password" name="password" required help="At least 8 characters">
                <UInput v-model="formState.password" type="password" placeholder="Enter a secure password" icon="i-lucide-lock" class="w-full" />
              </UFormField>

              <!-- Number Input -->
              <UFormField label="Age" name="age" required help="You must be at least 18 years old">
                <UInput v-model.number="formState.age" type="number" placeholder="Enter your age" icon="i-lucide-calendar" class="w-full" />
              </UFormField>

              <!-- Textarea -->
              <UFormField label="Bio" name="bio" help="Optional - maximum 500 characters" class="col-span-2">
                <UTextarea v-model="formState.bio" placeholder="Tell us about yourself..." :rows="4" class="w-full" />
              </UFormField>

              <!-- Select Dropdown -->
              <UFormField label="Country" name="country" required>
                <USelect v-model="formState.country" :items="countryOptions" placeholder="Select your country" class="w-full" />
              </UFormField>

              <!-- Select Menu (Multiple Selection) -->
              <UFormField label="Areas of Interest" name="interests" required help="Select at least one interest">
                <USelectMenu v-model="formState.interests" :items="interestOptions" value-key="value" multiple placeholder="Select your interests" class="w-full" />
              </UFormField>



              <!-- Range/Slider -->
              <UFormField label="Expected Salary (USD)" name="salary" :help="`$${formState.salary.toLocaleString()} per year`">
                <USlider v-model="formState.salary" :min="0" :max="200000" :step="1000" class="w-full" />
              </UFormField>

              <!-- Toggle Switch -->
              <UFormField label="Newsletter Subscription" name="newsletter" help="Receive updates about new features">
                <USwitch v-model="formState.newsletter" />
              </UFormField>

              <!-- Radio Group -->
              <UFormField label="Preferred Contact Method" name="preferredContact" required>
                <URadioGroup v-model="formState.preferredContact" :items="contactMethodOptions" />
              </UFormField>

              <UFormField name="image" label="Image" description="JPG, GIF or PNG. 2MB Max.">
                <UFileUpload v-model="formState.image" accept="image/*" class="min-h-48" />
              </UFormField>

              <!-- Checkbox -->
              <UFormField name="acceptTerms" required>
                <UCheckbox v-model="formState.acceptTerms" label="I accept the terms and conditions" />
              </UFormField>

              <!-- Submit Button -->
              <div class="flex items-center gap-3 pt-4">
                <UButton type="submit" color="primary" size="lg" icon="i-lucide-send"> Submit Form </UButton>
                <p class="text-xs text-neutral-500">All data will be logged to the console</p>
              </div>
            </UForm>
          </div>
        </UCard>

        <!-- Documentation Links -->
        <UCard variant="outline">
          <template #header>
            <h3 class="text-xl font-semibold text-neutral-900 dark:text-white">Weitere Ressourcen</h3>
          </template>

          <div class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <div>
                <h4 class="font-medium text-neutral-900 dark:text-white">Nuxt UI Dokumentation</h4>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">Alle verfügbaren Komponenten und deren Props</p>
              </div>
              <UButton to="https://ui.nuxt.com" target="_blank" trailing-icon="i-lucide-external-link" variant="outline" color="neutral" size="sm"> Docs </UButton>
            </div>

            <div class="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <div>
                <h4 class="font-medium text-neutral-900 dark:text-white">GitHub Repository</h4>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">Source Code und weitere Beispiele</p>
              </div>
              <UButton to="https://github.com/lenneTech/nuxt-base" target="_blank" trailing-icon="i-lucide-external-link" variant="outline" color="neutral" size="sm">
                GitHub
              </UButton>
            </div>

            <div class="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
              <div>
                <h4 class="font-medium text-neutral-900 dark:text-white">CLAUDE.md</h4>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">Detaillierte Projekt-Dokumentation</p>
              </div>
              <UBadge color="primary" variant="subtle"> Im Projekt enthalten </UBadge>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
